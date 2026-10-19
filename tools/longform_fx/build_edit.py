#!/usr/bin/env python3
"""Build an edit JSON (captions, framing, emphasis, transitions) from a
word-timestamped transcript plus a per-video directives file.

Usage:
  python3 build_edit.py --stt stt.json --directives directives.json --out edit.json

stt.json: ElevenLabs speech-to-text response (timestamps_granularity=word).
"""
import argparse
import json
import re

FRAMINGS = {"wide": 1.2, "medium": 1.45, "close": 1.75}
CYCLE = ["wide", "medium", "close", "medium"]
MAX_CHARS = 20


def snap(t, fps):
    return round(t * fps) / fps


def load_words(path, start, end):
    words = json.load(open(path))["words"]
    return [w for w in words if w["type"] == "word" and start <= w["start"] < end]


def sentences(words):
    out, cur = [], []
    for w in words:
        cur.append(w)
        if re.search(r'[.?!]["\']?$', w["text"]):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def chunk_sentence(sent):
    """Split a sentence into caption chunks of at most MAX_CHARS (no spaces)."""
    chunks, cur, n = [], [], 0
    for w in sent:
        size = len(w["text"])
        if cur and n + size > MAX_CHARS:
            chunks.append(cur)
            cur, n = [], 0
        cur.append(w)
        n += size
    if cur:
        chunks.append(cur)
    # avoid a dangling one-word tail
    if len(chunks) > 1 and len(chunks[-1]) == 1 and sum(len(w["text"]) for w in chunks[-2]) < MAX_CHARS:
        tail = chunks.pop()
        chunks[-1] += tail
    return chunks


def build(stt, d):
    fps = d["fps"]
    start, end = d["range"]
    words = load_words(stt, start, end)
    sents = sentences(words)
    emph_times = [e["t"] for e in d["emphasis"]]
    trans_times = {round(t["t"], 2): t for t in d["transitions"]}

    # framing: one segment per sentence; emphasised sentences go close
    segments, prev = [], None
    for i, s in enumerate(sents):
        s0 = start if i == 0 else snap(s[0]["start"] - 0.05, fps)
        s1 = end if i == len(sents) - 1 else snap(sents[i + 1][0]["start"] - 0.05, fps)
        punches = [t for t in emph_times if s0 <= t < s1 and next(e for e in d["emphasis"] if e["t"] == t).get("punch")]
        if punches:
            framing = "close" if prev != "close" else "medium"
        else:
            framing = CYCLE[i % len(CYCLE)]
            if framing == prev:
                framing = CYCLE[(i + 1) % len(CYCLE)]
        prev = framing
        segments.append({
            "start": s0, "end": s1, "framing": framing, "zoom": FRAMINGS[framing],
            "punch_at": [snap(t, fps) for t in punches],
        })

    # captions with keyword highlight
    kw = d.get("keywords", [])
    repl = d.get("replace", {})
    captions = []
    for s in sents:
        for c in chunk_sentence(s):
            captions.append({
                "start": c[0]["start"], "end": c[-1]["end"],
                "words": [{"text": repl.get(w["text"], w["text"]), "hl": any(w["text"].strip('"\'').startswith(k) for k in kw)} for w in c],
            })
    for a, b in zip(captions, captions[1:]):
        if b["start"] - a["end"] < 0.35:
            a["end"] = b["start"]

    # emphasis pop-ups last until the next pop-up or max 1.8s
    emphasis = []
    for i, e in enumerate(sorted(d["emphasis"], key=lambda e: e["t"])):
        nxt = d["emphasis"][i + 1]["t"] if i + 1 < len(d["emphasis"]) else end
        emphasis.append({**e, "end": round(min(e["t"] + e.get("dur", 1.8), nxt - 0.05), 2)})

    return {
        "source": d["source"], "range": [start, end], "fps": fps,
        "output": d.get("output", {"width": 1920, "height": 1080}),
        "face": d["face"], "segments": segments, "captions": captions,
        "emphasis": emphasis, "transitions": list(trans_times.values()),
        "sfx_volume": d.get("sfx_volume", 0.45),
        "speed": d.get("speed", 1.0), "retouch": d.get("retouch"),
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--stt", required=True)
    ap.add_argument("--directives", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    edit = build(a.stt, json.load(open(a.directives)))
    json.dump(edit, open(a.out, "w"), ensure_ascii=False, indent=1)
    print(f"{len(edit['segments'])} segments, {len(edit['captions'])} captions, "
          f"{len(edit['emphasis'])} emphasis, {len(edit['transitions'])} transitions")
