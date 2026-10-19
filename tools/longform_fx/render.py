#!/usr/bin/env python3
"""Render an edit JSON (from build_edit.py) onto the source video with ffmpeg.

- framing / punch zoom / whip / shake: one zoompan pass over the source
- captions, keyword pop-ups, flash transitions: generated ASS subtitles
- SFX: mixed over the original audio

Usage:
  python3 render.py --edit edit.json --fonts fonts/ --sfx sfx/ --out out.mp4 [--preview]
"""
import argparse
import json
import os
import subprocess

YELLOW = "&H004DE1FF&"
WHITE = "&H00FFFFFF&"
GRAY = "&H00A0A0A0&"

ASS_HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Pretendard Black,78,&H00FFFFFF,&H000000FF,&H00000000,&H78000000,0,0,0,0,100,100,0,0,1,7,3,2,60,60,64,1
Style: Boom,Black Han Sans,156,&H004DE1FF,&H000000FF,&H00000000,&H96000000,0,0,0,0,100,100,2,0,1,11,7,5,0,0,0,1
Style: Tag,Black Han Sans,92,&H00FFFFFF,&H000000FF,&H003838E8,&H003838E8,0,0,0,0,100,100,2,0,3,16,0,5,0,0,0,1
Style: Fx,Pretendard Black,10,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def ts(t):
    t = max(t, 0)
    h, r = divmod(t, 3600)
    m, s = divmod(r, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def build_ass(edit):
    w, h = edit["output"]["width"], edit["output"]["height"]
    t0 = edit["range"][0]
    lines = [ASS_HEADER.format(w=w, h=h)]

    def norm(x):
        return "".join(ch for ch in x if ch.isalnum())

    popped = {norm(e["text"]) for e in edit["emphasis"]}
    for c in edit["captions"]:
        if norm("".join(x["text"] for x in c["words"])) in popped:
            continue  # the pop-up already shows this line
        text = " ".join(
            f"{{\\c{YELLOW}}}{x['text']}{{\\c{WHITE}}}" if x["hl"] else x["text"] for x in c["words"]
        )
        anim = "{\\fscx112\\fscy112\\t(0,100,\\fscx100\\fscy100)}"
        lines.append(f"Dialogue: 1,{ts(c['start']-t0)},{ts(c['end']-t0)},Cap,,0,0,0,,{anim}{text}")

    for e in edit["emphasis"]:
        x, y = w // 2, e.get("y", 800)
        rot = e.get("rot", -4 if e["style"] == "boom" else 3)
        if e["style"] == "boom":
            tags = (f"{{\\an5\\pos({x},{y})\\frz{rot}\\fscx30\\fscy30"
                    "\\t(0,110,\\fscx122\\fscy122)\\t(110,210,\\fscx100\\fscy100)\\fad(0,150)}")
            style, text = "Boom", e["text"]
        elif e["style"] == "strike":
            tags = (f"{{\\an5\\pos({x},{y})\\frz{rot}\\c{GRAY}\\s1\\fscx60\\fscy60"
                    "\\t(0,120,\\fscx105\\fscy105)\\t(120,200,\\fscx100\\fscy100)\\fad(0,120)}")
            style, text = "Boom", e["text"]
        else:
            tags = (f"{{\\an5\\pos({x},{y})\\frz{rot}\\fscx55\\fscy55"
                    "\\t(0,120,\\fscx108\\fscy108)\\t(120,200,\\fscx100\\fscy100)\\fad(0,120)}")
            style, text = "Tag", f" {e['text']} "
        lines.append(f"Dialogue: 5,{ts(e['t']-t0)},{ts(e['end']-t0)},{style},,0,0,0,,{tags}{text}")

    rect = f"m 0 0 l {w} 0 {w} {h} 0 {h}"
    for tr in edit["transitions"]:
        if tr["type"] == "flash":
            lines.append(
                f"Dialogue: 9,{ts(tr['t']-t0)},{ts(tr['t']-t0+0.28)},Fx,,0,0,0,,"
                f"{{\\an7\\pos(0,0)\\p1\\bord0\\shad0\\alpha&H30&\\fad(0,240)}}{rect}{{\\p0}}"
            )
    return "\n".join(lines) + "\n"


def nest(pieces, default):
    """pieces: [(end_time, expr)] in order -> nested if over `it`."""
    expr = default
    for end, e in reversed(pieces):
        expr = f"if(lt(it,{end:.4f}),{e},{expr})"
    return expr


def crop_center(zoom, face):
    fx, fy = face
    win = 1 / zoom
    cx = min(max(fx, win / 2), 1 - win / 2)
    cy = min(max(fy - 0.36 * win + win / 2, win / 2), 1 - win / 2)
    return cx, cy


def build_zoompan(edit):
    t0 = edit["range"][0]
    out = edit["output"]
    z_p, cx_p, cy_p = [], [], []
    trans = [tr["t"] - t0 for tr in edit["transitions"]]
    for s in edit["segments"]:
        a, b = s["start"] - t0, s["end"] - t0
        z = f"{s['zoom']}"
        for p in s["punch_at"]:
            z += f"*(1+0.12*clip((it-{p - t0:.3f})/0.08,0,1))"
        for tt in trans:
            if a - 0.01 <= tt < b:
                z += f"*(1+0.35*pow(1-clip((it-{tt:.3f})/0.3,0,1),2))"
        cx, cy = crop_center(s["zoom"], edit["face"])
        z_p.append((b, z))
        cx_p.append((b, f"{cx:.4f}"))
        cy_p.append((b, f"{cy:.4f}"))

    shake = "0"
    for e in edit["emphasis"]:
        if e.get("shake"):
            st = e["t"] - t0
            shake += f"+18*sin(it*90)*clip(1-(it-{st:.3f})/0.35,0,1)*gte(it,{st:.3f})"

    z = nest(z_p, "1")
    cx, cy = nest(cx_p, "0.5"), nest(cy_p, "0.5")
    x = f"clip(({cx})*iw-iw/zoom/2+({shake}),0,iw-iw/zoom)"
    y = f"clip(({cy})*ih-ih/zoom/2+0.6*({shake}),0,ih-ih/zoom)"
    return (f"zoompan=z='{z}':x='{x}':y='{y}':d=1:"
            f"s={out['width']}x{out['height']}:fps={edit['fps']}")


def render(edit, fonts, sfx_dir, out, preview=False):
    work = os.path.splitext(out)[0]
    ass_path = work + ".ass"
    open(ass_path, "w").write(build_ass(edit))

    t0, t1 = edit["range"]
    events = [(e["t"], e["sfx"]) for e in edit["emphasis"] if e.get("sfx")]
    events += [(tr["t"] - 0.15, tr["sfx"]) for tr in edit["transitions"] if tr.get("sfx")]

    inputs = ["-ss", str(t0), "-t", f"{t1 - t0:.3f}", "-i", edit["source"]]
    for _, name in events:
        inputs += ["-i", os.path.join(sfx_dir, f"{name}.wav")]

    vol = edit["sfx_volume"]
    fg = [f"[0:v]{build_zoompan(edit)},subtitles='{ass_path}':fontsdir='{fonts}'[v]"]
    mix = ["[0:a]aresample=48000[a0]"]
    labels = "[a0]"
    for i, (t, _) in enumerate(events, 1):
        ms = max(int((t - t0) * 1000), 0)
        mix.append(f"[{i}:a]adelay={ms}|{ms},volume={vol}[s{i}]")
        labels += f"[s{i}]"
    mix.append(f"{labels}amix=inputs={len(events) + 1}:normalize=0:duration=first[a]")
    script = work + ".filter"
    open(script, "w").write(";\n".join(fg + mix))

    preset = ["-preset", "veryfast", "-crf", "23"] if preview else ["-preset", "medium", "-crf", "18"]
    cmd = ["ffmpeg", "-y", "-v", "error", "-stats", *inputs, "-filter_complex_script", script,
           "-map", "[v]", "-map", "[a]", "-c:v", "libx264", *preset, "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out]
    subprocess.run(cmd, check=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--edit", required=True)
    ap.add_argument("--fonts", required=True)
    ap.add_argument("--sfx", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--preview", action="store_true")
    a = ap.parse_args()
    render(json.load(open(a.edit)), a.fonts, a.sfx, a.out, a.preview)
