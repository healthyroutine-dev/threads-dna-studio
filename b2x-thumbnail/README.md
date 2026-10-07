# b2x-thumbnail

B2X · K-Beauty Influencer Academy 릴스 썸네일(9:16, 1080×1920) 생성 도구.

- `THUMBNAIL_SPEC.md` — 레이아웃·좌표·색·폰트 규칙 (v12 확정본). 여기 숫자가 기준.
- `make_thumb.py` — 규칙대로 렌더링하는 스크립트 (playwright + Chromium 필요)
- `episodes.json` — 24편 제목·카테고리 목록. `backgrounds/epNN.jpg`만 채우면 `--batch`로 한 번에 생성
- `assets/ceo_circle.png` — 대표 PiP 원형 이미지 (`ceo_source.webp` 원본)
- `out/sample_ep17.png`, `out/sample_ep01.png` — 아카데미편 / 현장편 샘플

```bash
pip install playwright pillow && playwright install chromium   # 최초 1회
# Pretendard Bold/Regular 폰트 설치 필수 (없으면 실행이 멈춤)
python3 make_thumb.py --batch episodes.json
```
