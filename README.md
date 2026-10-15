# threads-dna-studio

## 릴스 내레이션 생성 (ElevenLabs)

1. `pip install -r requirements.txt`
2. 환경변수 `ELEVENLABS_API_KEY` 설정 (Claude Code 클라우드 환경에서는 네트워크 시크릿으로 `api.elevenlabs.io` + `xi-api-key` 헤더 등록)
3. `python narration/tts.py voices` 로 목소리 목록 확인 → 원하는 ID를 `ELEVENLABS_VOICE_ID` 로 설정
4. `narration/scripts/` 에 대본을 `01_제목.txt`, `02_제목.txt` … 형식으로 저장 (파일 1개 = 릴스 1개)
5. `python narration/tts.py --dry-run` 으로 예상 크레딧 확인
6. `python narration/tts.py` → `narration/output/*.mp3` 생성

이미 생성된 mp3는 건너뛰므로 대본을 추가하고 다시 실행해도 크레딧이 중복으로 나가지 않습니다.
특정 대본만 다시 만들려면 `python narration/tts.py --force 03_제목`.
