# K-Beauty que vende · 릴스 템플릿

레퍼런스 영상을 전체 화면에 깔고, 분석 포인트마다 영상을 멈춰 그 위에 카드로 설명하는 포맷 (v2, 스페인어).

| 파일 | 역할 |
|---|---|
| `overlay.html` | 상단 헤더(시리즈 번호·크리에이터·요인 칩 5개·원본 자막 번역) + 정지 카드 디자인. 칩 이름·번역 문구·크리에이터 정보는 여기서 바꾼다 |
| `plan.json` | 카드 문구(`cards`)와 타임라인(`segs`: `play` 구간 재생 / `freeze` 정지 + 카드) |
| `render2.mjs` | `plan.json`의 구간마다 오버레이 PNG를 그림 (Playwright) |
| `build2.py` | 구간별로 영상을 자르고 오버레이를 얹어 하나로 이어 붙임 (ffmpeg) |

만드는 순서
1. 레퍼런스 영상을 `src_<id>.mp4`로 받고 `build2.py`의 `SRC`를 바꾼다.
2. 장면 전환 시간 확인: `ffmpeg -i src.mp4 -vf "select='gt(scene,0.25)',showinfo" -f null - 2>&1 | grep pts_time`
3. `overlay.html`, `plan.json` 문구와 시간을 바꾼다.
4. 폰트(Pretendard woff2)를 이 폴더에 받는다 (`build.sh` 참고).
5. `node render2.mjs && python3 build2.py`

v1(`panel.html`·`render.mjs`·`build.sh`)은 원본을 아래로 내리고 위에 패널을 두는 이전 방식.

## v3: 더빙 (현재 기본)

- `plan.json`의 카드마다 `voice`(한국어 내레이션 문장)를 넣는다.
- `tts.py`: 무료 엣지 TTS(`ko-KR-SunHiNeural`)로 음성 생성. 정식본은 채원 대표 녹음으로 바꾼다.
- `build3.py`: 음성 생성 → 앞뒤 무음 제거 → 말 길이에 맞춰 정지 시간 결정 → 오버레이 렌더 → 영상 합성 → 음성 믹스까지 한 번에.
- 헤더는 검정 배경(높이 540)으로 영상 위를 덮는다. 정지 카드는 헤더 아래 영역에 뜬다.
- 실행: `python3 build3.py` (`pip install edge-tts`, 폰트 woff2 필요)
