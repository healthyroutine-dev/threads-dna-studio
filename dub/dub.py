"""한국어 영상 → 같은 목소리의 스페인어 보이스오버 더빙.

원음(한국어)은 작게 깔고, 그 위에 화자 본인 목소리(복제)로 스페인어를 얹는다.

단계:
  1) prepare  영상 → 음성 추출 → 잡음 제거(Voice Isolator) → 목소리 복제(IVC)
              → 받아쓰기(Scribe, 타임스탬프) → work/<이름>/segments.json
  2) 번역     segments.json 의 각 구간 "es" 칸을 채운다 (Claude 가 직접 번역)
  3) render   구간별 스페인어 TTS → 원래 타이밍에 배치 → 원음 볼륨 낮춰 믹스
              → work/<이름>/<이름>_es.mp4

사용법:
  python dub/dub.py prepare 영상.mp4 --speaker "채원"
  python dub/dub.py render 영상.mp4 [--ko-volume 0.18]

API 키: ELEVENLABS_API_KEY 환경변수, 또는 클라우드 환경의 네트워크 시크릿(xi-api-key).
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

import requests

API = "https://api.elevenlabs.io/v1"
WORK = Path(__file__).parent / "work"
TTS_MODEL = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")
STT_MODEL = os.environ.get("ELEVENLABS_STT_MODEL", "scribe_v1")
CLONE_SECONDS = 180  # 복제용 샘플 길이 상한 (IVC 는 1~3분이면 충분)
MAX_SPEEDUP = 1.25   # 스페인어가 구간보다 길 때 허용하는 최대 배속
PAUSE_GAP = 0.7      # 이 이상 쉬면 구간을 나눈다 (초)

VOICE_SETTINGS = {"stability": 0.5, "similarity_boost": 0.85, "style": 0.0, "use_speaker_boost": True}


# ---------- 공통 ----------

def auth_headers():
    key = os.environ.get("ELEVENLABS_API_KEY")
    return {"xi-api-key": key} if key else {}


def call(method, path, **kw):
    r = requests.request(method, f"{API}{path}", headers=auth_headers(), timeout=600, **kw)
    if r.status_code == 401:
        sys.exit(f"인증/권한 오류(401) {path}: {r.text[:300]}")
    if not r.ok:
        sys.exit(f"API 오류 {r.status_code} {path}: {r.text[:300]}")
    return r


def ff(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        check=True, capture_output=True, text=True,
    ).stdout
    return float(out.strip())


def workdir(video):
    d = WORK / Path(video).stem
    d.mkdir(parents=True, exist_ok=True)
    return d


# ---------- prepare ----------

def segment_words(words):
    """단어 타임스탬프를 문장/쉼 기준으로 묶는다."""
    segs, cur = [], []
    for w in words:
        if w.get("type") != "word":
            continue
        if cur and w["start"] - cur[-1]["end"] > PAUSE_GAP:
            segs.append(cur)
            cur = []
        cur.append(w)
        if w["text"].rstrip().endswith((".", "?", "!", "다.", "요.")):
            segs.append(cur)
            cur = []
    if cur:
        segs.append(cur)
    return [
        {
            "id": i + 1,
            "start": round(s[0]["start"], 3),
            "end": round(s[-1]["end"], 3),
            "ko": " ".join(w["text"] for w in s).strip(),
            "es": "",
        }
        for i, s in enumerate(segs)
    ]


def prepare(args):
    d = workdir(args.video)
    audio = d / "audio.wav"
    clean = d / "voice_clean.mp3"
    sample = d / "clone_sample.mp3"
    voice_file = d / "voice_id.txt"
    seg_file = d / "segments.json"

    print("1/4 음성 추출")
    ff("-i", args.video, "-vn", "-ac", "1", "-ar", "44100", str(audio))

    if not clean.exists():
        print("2/4 잡음 제거 (Voice Isolator)")
        with open(audio, "rb") as f:
            r = call("POST", "/audio-isolation", files={"audio": ("audio.wav", f, "audio/wav")})
        clean.write_bytes(r.content)

    if voice_file.exists():
        voice_id = voice_file.read_text().strip()
        print(f"3/4 목소리 복제 — 기존 voice_id 사용: {voice_id}")
    else:
        print("3/4 목소리 복제 (Instant Voice Clone)")
        ff("-i", str(clean), "-t", str(CLONE_SECONDS), str(sample))
        with open(sample, "rb") as f:
            r = call(
                "POST", "/voices/add",
                data={"name": args.speaker, "description": f"{args.speaker} — {Path(args.video).name} 에서 복제"},
                files={"files": ("sample.mp3", f, "audio/mpeg")},
            )
        voice_id = r.json()["voice_id"]
        voice_file.write_text(voice_id)
        print(f"    voice_id = {voice_id}")

    print("4/4 받아쓰기 (Scribe)")
    with open(clean, "rb") as f:
        r = call(
            "POST", "/speech-to-text",
            data={"model_id": STT_MODEL, "language_code": "kor", "timestamps_granularity": "word",
                  "tag_audio_events": "false"},
            files={"file": ("voice.mp3", f, "audio/mpeg")},
        )
    segs = segment_words(r.json()["words"])
    if seg_file.exists():  # 다시 실행해도 이미 채운 번역은 유지
        prev = {x["ko"]: x["es"] for x in json.loads(seg_file.read_text(encoding="utf-8"))["segments"]}
        for x in segs:
            x["es"] = prev.get(x["ko"], "")
    meta = {"video": str(Path(args.video).resolve()), "voice_id": voice_id,
            "duration": duration(args.video), "segments": segs}
    seg_file.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n구간 {len(segs)}개 → {seg_file}")
    print("다음: 각 구간의 \"es\" 칸에 스페인어 번역을 채운 뒤 render 실행")


# ---------- render ----------

def render(args):
    d = workdir(args.video)
    meta = json.loads((d / "segments.json").read_text(encoding="utf-8"))
    segs = [s for s in meta["segments"] if s["es"].strip()]
    missing = [s["id"] for s in meta["segments"] if not s["es"].strip()]
    if missing:
        sys.exit(f"번역이 비어 있는 구간: {missing}")

    tts_dir = d / "tts"
    tts_dir.mkdir(exist_ok=True)
    total = meta["duration"]
    placed = []

    for i, s in enumerate(segs):
        raw = tts_dir / f"{s['id']:03d}.mp3"
        if args.force or not raw.exists():
            r = call(
                "POST", f"/text-to-speech/{meta['voice_id']}",
                params={"output_format": "mp3_44100_128"},
                json={
                    "text": s["es"], "model_id": TTS_MODEL, "voice_settings": VOICE_SETTINGS,
                    "previous_text": segs[i - 1]["es"] if i else None,
                    "next_text": segs[i + 1]["es"] if i + 1 < len(segs) else None,
                },
            )
            raw.write_bytes(r.content)

        # 다음 구간 시작 전까지 들어가도록, 필요하면 살짝 빠르게
        slot = (segs[i + 1]["start"] if i + 1 < len(segs) else total) - s["start"]
        dur = duration(raw)
        speed = min(max(dur / slot, 1.0), MAX_SPEEDUP) if slot > 0 else 1.0
        fitted = tts_dir / f"{s['id']:03d}_fit.wav"
        ff("-i", str(raw), "-filter:a", f"atempo={speed:.3f}", "-ar", "44100", "-ac", "1", str(fitted))
        over = dur / speed - slot
        flag = f"  ⚠ {over:.1f}s 넘침 — 번역을 줄이면 좋음" if over > 0.3 else ""
        print(f"  #{s['id']:>3} {s['start']:7.2f}s  {dur:5.1f}s → x{speed:.2f}{flag}")
        placed.append((fitted, s["start"]))

    print("믹싱")
    inputs, filters = ["-i", meta["video"]], []
    filters.append(f"[0:a]aformat=sample_rates=44100:channel_layouts=mono,volume={args.ko_volume}[ko]")
    labels = ["[ko]"]
    for n, (path, start) in enumerate(placed, start=1):
        inputs += ["-i", str(path)]
        ms = int(start * 1000)
        filters.append(f"[{n}:a]adelay={ms}|{ms},volume={args.es_volume}[es{n}]")
        labels.append(f"[es{n}]")
    filters.append(f"{''.join(labels)}amix=inputs={len(labels)}:duration=first:normalize=0,alimiter=limit=0.95[mix]")

    out = d / f"{Path(args.video).stem}_es.mp4"
    ff(*inputs, "-filter_complex", ";".join(filters), "-map", "0:v", "-map", "[mix]",
       "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(out))
    print(f"\n완성 → {out}")


def main():
    p = argparse.ArgumentParser(description="한국어 영상 → 스페인어 보이스오버 더빙 (ElevenLabs)")
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("prepare", help="추출·잡음제거·목소리복제·받아쓰기")
    a.add_argument("video")
    a.add_argument("--speaker", default="speaker", help="복제 목소리 이름")
    b = sub.add_parser("render", help="스페인어 TTS + 믹스")
    b.add_argument("video")
    b.add_argument("--ko-volume", type=float, default=0.18, help="한국어 원음 볼륨 (기본 0.18)")
    b.add_argument("--es-volume", type=float, default=1.0, help="스페인어 볼륨")
    b.add_argument("--force", action="store_true", help="스페인어 TTS 다시 생성")
    args = p.parse_args()
    {"prepare": prepare, "render": render}[args.cmd](args)


if __name__ == "__main__":
    main()
