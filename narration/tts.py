"""릴스 내레이션 일괄 생성기 (ElevenLabs Text-to-Speech).

narration/scripts/*.txt 파일 하나 = 릴스 하나. 같은 이름의 mp3가
narration/output/ 에 만들어진다. 이미 만들어진 파일은 건너뛰므로
크레딧이 두 번 나가지 않는다.

사용법:
  python narration/tts.py voices          # 사용 가능한 목소리 목록
  python narration/tts.py --dry-run       # 글자 수 / 예상 크레딧만 확인
  python narration/tts.py                 # 새 대본만 생성
  python narration/tts.py --force 03_hook # 특정 대본 다시 생성

환경변수:
  ELEVENLABS_API_KEY   (선택 — Claude Code 클라우드 환경의 '네트워크 시크릿'으로
                        api.elevenlabs.io 에 xi-api-key 헤더를 등록했다면 불필요)
  ELEVENLABS_VOICE_ID  (생성 시 필수, `voices` 로 확인)
  ELEVENLABS_MODEL_ID  (기본: eleven_multilingual_v2 — 한국어 지원)
"""

import argparse
import os
import sys
from pathlib import Path

import requests

API = "https://api.elevenlabs.io/v1"
ROOT = Path(__file__).parent
SCRIPTS_DIR = ROOT / "scripts"
OUTPUT_DIR = ROOT / "output"
DEFAULT_MODEL = "eleven_multilingual_v2"

# 릴스 내레이션용 기본값: 톤이 들쭉날쭉하지 않도록 안정성을 약간 높게.
VOICE_SETTINGS = {
    "stability": 0.55,
    "similarity_boost": 0.75,
    "style": 0.2,
    "use_speaker_boost": True,
    "speed": 1.05,
}


def auth_headers():
    # 키가 없으면 헤더를 비워 둔다. 네트워크 시크릿을 쓰는 환경에서는
    # 프록시가 xi-api-key 헤더를 대신 붙여 준다.
    key = os.environ.get("ELEVENLABS_API_KEY")
    return {"xi-api-key": key} if key else {}


def check(r):
    if r.status_code == 401:
        sys.exit("인증 실패(401): ELEVENLABS_API_KEY 환경변수나 네트워크 시크릿을 확인하세요.")
    if not r.ok:
        raise RuntimeError(f"{r.status_code} {r.text[:300]}")


def list_voices():
    r = requests.get(f"{API}/voices", headers=auth_headers(), timeout=30)
    check(r)
    for v in r.json()["voices"]:
        labels = ", ".join(f"{k}={val}" for k, val in (v.get("labels") or {}).items())
        print(f"{v['voice_id']}  {v['name']:<20} {labels}")


def load_scripts(only):
    files = sorted(SCRIPTS_DIR.glob("*.txt"))
    if only:
        files = [f for f in files if f.stem in only]
    return [(f.stem, f.read_text(encoding="utf-8").strip()) for f in files]


def synthesize(text, voice_id, model_id):
    r = requests.post(
        f"{API}/text-to-speech/{voice_id}",
        params={"output_format": "mp3_44100_128"},
        headers={**auth_headers(), "Content-Type": "application/json"},
        json={"text": text, "model_id": model_id, "voice_settings": VOICE_SETTINGS},
        timeout=120,
    )
    check(r)
    return r.content


def generate(args):
    scripts = load_scripts(args.names)
    if not scripts:
        sys.exit(f"{SCRIPTS_DIR} 에 .txt 대본이 없습니다.")

    todo = [
        (name, text)
        for name, text in scripts
        if text and (args.force or not (OUTPUT_DIR / f"{name}.mp3").exists())
    ]
    chars = sum(len(t) for _, t in todo)
    print(f"생성 대상 {len(todo)}개 / 전체 {len(scripts)}개, 약 {chars:,}자 (≈ {chars:,} 크레딧)")
    if args.dry_run or not todo:
        return

    voice_id = os.environ.get("ELEVENLABS_VOICE_ID")
    if not voice_id:
        sys.exit("ELEVENLABS_VOICE_ID 환경변수가 필요합니다. `python narration/tts.py voices` 로 확인하세요.")
    model_id = os.environ.get("ELEVENLABS_MODEL_ID", DEFAULT_MODEL)

    OUTPUT_DIR.mkdir(exist_ok=True)
    failed = []
    for name, text in todo:
        try:
            audio = synthesize(text, voice_id, model_id)
        except Exception as e:  # 하나가 실패해도 나머지는 계속 진행
            print(f"  ✗ {name}: {e}")
            failed.append(name)
            continue
        (OUTPUT_DIR / f"{name}.mp3").write_bytes(audio)
        print(f"  ✓ {name}.mp3 ({len(text)}자)")

    if failed:
        sys.exit(f"실패 {len(failed)}개: {', '.join(failed)} — 다시 실행하면 실패한 것만 재시도합니다.")


def main():
    p = argparse.ArgumentParser(description="릴스 내레이션 일괄 생성 (ElevenLabs)")
    p.add_argument("names", nargs="*", help="'voices' 또는 생성할 대본 이름(확장자 제외). 생략 시 전체")
    p.add_argument("--force", action="store_true", help="이미 있는 mp3도 다시 생성")
    p.add_argument("--dry-run", action="store_true", help="API 호출 없이 글자 수만 계산")
    args = p.parse_args()

    if args.names == ["voices"]:
        list_voices()
    else:
        generate(args)


if __name__ == "__main__":
    main()
