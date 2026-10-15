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


## 스페인어 보이스오버 더빙 (ElevenLabs)

한국어 원음은 작게 깔고, 화자 본인 목소리(복제)로 스페인어를 얹는다.

1. `python dub/dub.py prepare 영상.mp4 --speaker "이름"` — 음성 추출 → 잡음 제거 → 목소리 복제 → 받아쓰기
2. `dub/work/<영상이름>/segments.json` 의 각 구간 `"es"` 에 스페인어 번역 입력
3. `python dub/dub.py render 영상.mp4 --ko-volume 0.18` → `dub/work/<영상이름>/<영상이름>_es.mp4`

필요한 API 키 권한: Text to Speech, Speech to Text, Voice Isolator, Voices(Write).
목소리 복제는 반드시 본인 동의를 받은 뒤 진행한다.
