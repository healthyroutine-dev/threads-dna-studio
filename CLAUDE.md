# B2X 작업 저장소

사용자 PC의 `C:\dev\B2X` 와 git으로 동기화한다. 작업 브랜치는 `claude/zen-hopper-2awbpm`.
작업이 끝나면 항상 commit + push 해서 사용자가 `git pull` 로 받을 수 있게 한다.

## 썸네일
- 규격: `b2x-thumbnail/THUMBNAIL_SPEC.md` (v12 확정본). 좌표·색·폰트는 이 문서 숫자가 기준이고, 바꿀 때는 문서와 `make_thumb.py`를 같이 고친다.
- 생성: `python3 b2x-thumbnail/make_thumb.py --batch b2x-thumbnail/episodes.json`
- 폰트는 Pretendard(Bold/Regular) 확정. 없으면 make_thumb.py가 멈춘다. 대체 폰트 쓰지 않는다.
- 배경 원본은 `b2x-thumbnail/backgrounds/epNN.jpg` (git 제외). 결과물은 `b2x-thumbnail/out/`.
