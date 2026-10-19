#!/usr/bin/env python3
"""Render an edit JSON (from build_edit.py) onto the source video with ffmpeg.

- framing / gentle punch-in / transition settle: one zoompan pass over the source
- skin retouch + tone: chroma-keyed skin mask, bilateral smoothing, eq/colorbalance
- captions, emphasis text, soft flash transitions: generated ASS subtitles
- SFX: mixed over the original audio
- playback speed: applied last (video setpts + audio atempo)

Usage:
  python3 render.py --edit edit.json --fonts fonts/ --sfx sfx/ --out out.mp4 [--preview]
"""
import argparse
import json
import os
import re
import subprocess

ASS_HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Pretendard Medium,46,&H00FFFFFF,&H000000FF,&H70000000,&H90000000,0,0,0,0,100,100,0,0,1,1.4,1.6,2,80,80,72,1
Style: Hand,East Sea Dokdo,118,&H0096F0A6,&H000000FF,&H00142814,&H90000000,0,0,0,0,100,100,1,0,1,4,3,5,0,0,0,1
Style: Cream,Pretendard SemiBold,68,&H00A4E8F7,&H000000FF,&H80000000,&H90000000,0,0,0,0,100,100,1,0,1,1.5,3,5,0,0,0,1
Style: Label,Pretendard Medium,40,&H00FFFFFF,&H000000FF,&H00101010,&H00101010,0,0,0,0,100,100,0,0,3,11,0,5,0,0,0,1
Style: Chapter,Black Han Sans,124,&H0096F0A6,&H000000FF,&H00142814,&H90000000,0,0,0,0,100,100,2,0,1,3,4,4,0,0,0,1
Style: Fx,Pretendard Medium,10,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

STYLE = {"hand": "Hand", "cream": "Cream", "label": "Label", "chapter": "Chapter"}
DEFAULT_POS = {"hand": (960, 820), "cream": (960, 980), "label": (960, 905), "chapter": (140, 560)}
REPLACES_CAPTION = {"hand", "cream", "chapter"}


def ts(t):
    t = max(t, 0)
    h, r = divmod(t, 3600)
    m, s = divmod(r, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def typewriter(start, end, text, layer, style, tags, cps=14, fade_out=220):
    """One event per revealed character; unrevealed tail stays transparent so layout is stable."""
    chars = re.findall(r"\\N|.", text)
    step = 1 / cps
    out = []
    for i in range(1, len(chars) + 1):
        a = start + (i - 1) * step
        b = end if i == len(chars) else start + i * step
        shown = "".join(chars[:i])
        hidden = "".join(chars[i:])
        body = shown + (f"{{\\alpha&HFF&}}{hidden}" if hidden else "")
        fade = f"{{\\fad(0,{fade_out})}}" if i == len(chars) else ""
        out.append(f"Dialogue: {layer},{ts(a)},{ts(b)},{style},,0,0,0,,{tags}{fade}{body}")
    return out


def emphasis_events(e, t0, w, h):
    style = e["style"]
    a, b = e["t"] - t0, e["end"] - t0
    x, y = e.get("pos", DEFAULT_POS[style])
    rot = e.get("rot", -3 if style == "hand" else 0)
    text = e["text"]
    if style == "hand":
        # written-in reveal: left-to-right clip wipe with a small lift
        half = int(max(len(line) for line in text.split("\\N")) * 118 * 0.5) + 40
        tags = (f"{{\\an5\\move({x},{y + 14},{x},{y},0,320)\\frz{rot}\\blur2"
                f"\\clip(0,0,{x - half},{h})\\t(0,{int(e.get('wipe', 0.6) * 1000)},\\clip(0,0,{x + half},{h}))"
                f"\\fad(0,260)}}")
        return [f"Dialogue: 5,{ts(a)},{ts(b)},Hand,,0,0,0,,{tags}{text}"]
    if style == "cream":
        tags = f"{{\\an5\\pos({x},{y})\\blur9\\t(0,260,\\blur1.5)\\fad(160,220)}}"
        if e.get("type"):
            return typewriter(a, b, text, 5, "Cream", f"{{\\an5\\pos({x},{y})\\blur1.5}}")
        return [f"Dialogue: 5,{ts(a)},{ts(b)},Cream,,0,0,0,,{tags}{text}"]
    if style == "label":
        tags = f"{{\\an5\\pos({x},{y})\\fscx88\\fscy88\\t(0,160,\\fscx100\\fscy100)\\fad(120,180)}}"
        return [f"Dialogue: 6,{ts(a)},{ts(b)},Label,,0,0,0,,{tags}{text}"]
    if style == "chapter":
        rect = f"m 0 0 l {w} 0 {w} {h} 0 {h}"
        dim = (f"Dialogue: 4,{ts(a)},{ts(b)},Fx,,0,0,0,,"
               f"{{\\an7\\pos(0,0)\\p1\\bord0\\shad0\\1c&H000000&\\alpha&H80&\\fad(200,250)}}{rect}{{\\p0}}")
        return [dim] + typewriter(a + 0.15, b, text, 5, "Chapter", f"{{\\an4\\pos({x},{y})}}", cps=12, fade_out=250)
    raise ValueError(f"unknown emphasis style {style}")


def build_ass(edit):
    w, h = edit["output"]["width"], edit["output"]["height"]
    t0 = edit["range"][0]
    lines = [ASS_HEADER.format(w=w, h=h)]

    covered = [(e["t"], e["end"]) for e in edit["emphasis"]
               if e["style"] in REPLACES_CAPTION and not e.get("keep_caption")]
    for c in edit["captions"]:
        mid = (c["start"] + c["end"]) / 2
        if any(a - 0.05 <= mid <= b for a, b in covered):
            continue  # the emphasis text stands in for this line
        text = " ".join(x["text"] for x in c["words"])
        lines.append(f"Dialogue: 1,{ts(c['start']-t0)},{ts(c['end']-t0)},Cap,,0,0,0,,{{\\blur0.8\\fad(60,60)}}{text}")

    for e in edit["emphasis"]:
        lines += emphasis_events(e, t0, w, h)

    rect = f"m 0 0 l {w} 0 {w} {h} 0 {h}"
    for tr in edit["transitions"]:
        if tr["type"] == "flash":
            lines.append(
                f"Dialogue: 9,{ts(tr['t']-t0)},{ts(tr['t']-t0+0.4)},Fx,,0,0,0,,"
                f"{{\\an7\\pos(0,0)\\p1\\bord0\\shad0\\alpha&H70&\\fad(80,300)}}{rect}{{\\p0}}"
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
            # slow ease-in push of 6% over 0.6s
            z += f"*(1+0.06*(1-pow(1-clip((it-{p - t0:.3f})/0.6,0,1),3)))"
        for tt in trans:
            if a - 0.01 <= tt < b:
                z += f"*(1+0.12*pow(1-clip((it-{tt:.3f})/0.45,0,1),2))"
        cx, cy = crop_center(s["zoom"], edit["face"])
        z_p.append((b, z))
        cx_p.append((b, f"{cx:.4f}"))
        cy_p.append((b, f"{cy:.4f}"))

    z = nest(z_p, "1")
    cx, cy = nest(cx_p, "0.5"), nest(cy_p, "0.5")
    x = f"clip(({cx})*iw-iw/zoom/2,0,iw-iw/zoom)"
    y = f"clip(({cy})*ih-ih/zoom/2,0,ih-ih/zoom)"
    return (f"zoompan=z='{z}':x='{x}':y='{y}':d=1:"
            f"s={out['width']}x{out['height']}:fps={edit['fps']}")


def retouch_chain(r):
    """Skin smoothing limited to a chroma-keyed skin mask, then global tone."""
    cb, cr = r.get("skin_cbcr", [110, 151])
    mask = (f"scale=480:270,format=yuv444p,"
            f"geq=lum='255*clip(1-(hypot(cb(X\\,Y)-{cb}\\,cr(X\\,Y)-{cr})-9)/9\\,0\\,1)"
            f"*clip((lum(X\\,Y)-55)/30\\,0\\,1)':cb=128:cr=128,format=gray,"
            f"scale={{w}}:{{h}},gblur=sigma=4,lut=y='val*{r.get('strength', 0.8)}'")
    tone = r.get("tone", "eq=brightness=0.015:contrast=0.98:saturation=1.03:gamma=1.03,"
                         "colorbalance=rm=0.02:bm=-0.015")
    return mask, tone


def render(edit, fonts, sfx_dir, out, preview=False):
    work = os.path.splitext(out)[0]
    ass_path = work + ".ass"
    open(ass_path, "w").write(build_ass(edit))
    w, h = edit["output"]["width"], edit["output"]["height"]
    speed = edit.get("speed", 1.0)

    t0, t1 = edit["range"]
    events = [(e["t"], e["sfx"]) for e in edit["emphasis"] if e.get("sfx")]
    events += [(tr["t"] - 0.15, tr["sfx"]) for tr in edit["transitions"] if tr.get("sfx")]

    inputs = ["-ss", str(t0), "-t", f"{t1 - t0:.3f}", "-i", edit["source"]]
    for _, name in events:
        inputs += ["-i", os.path.join(sfx_dir, f"{name}.wav")]

    fg = [f"[0:v]{build_zoompan(edit)}[zp]"]
    last = "zp"
    if edit.get("retouch"):
        mask, tone = retouch_chain(edit["retouch"])
        fg += [f"[zp]split=3[ra][rb][rc]",
               f"[rb]bilateral=sigmaS=8:sigmaR=0.05:planes=1[rs0]",
               f"[rc]{mask.format(w=w, h=h)}[rm]",
               f"[rs0][rm]alphamerge[rs]",
               f"[ra][rs]overlay,{tone}[rt]"]
        last = "rt"
    vtail = f",setpts=PTS/{speed},fps={edit['fps']}" if speed != 1.0 else ""
    fg.append(f"[{last}]subtitles='{ass_path}':fontsdir='{fonts}'{vtail}[v]")

    vol = edit["sfx_volume"]
    mix = ["[0:a]aresample=48000[a0]"]
    labels = "[a0]"
    for i, (t, _) in enumerate(events, 1):
        ms = max(int((t - t0) * 1000), 0)
        mix.append(f"[{i}:a]adelay={ms}|{ms},volume={vol}[s{i}]")
        labels += f"[s{i}]"
    atail = f",atempo={speed}" if speed != 1.0 else ""
    mix.append(f"{labels}amix=inputs={len(events) + 1}:normalize=0:duration=first{atail}[a]")
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
