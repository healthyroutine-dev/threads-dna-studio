# B2X · K-Beauty Influencer Academy — 릴스 썸네일 규격 (v12 확정)

9:16 인스타그램·틱톡 릴스 커버. 캔버스 **1080 × 1920 px**.
배경 이미지만 갈아끼우고 제목·카테고리만 정하면 같은 레이아웃이 나오도록 모든 좌표를 고정한다.
생성은 `make_thumb.py`가 이 규칙 그대로 렌더링한다 (아래 "사용법").

---

## 1. 레이어 순서 (아래 → 위)

| # | 레이어 | 규칙 |
|---|---|---|
| 1 | 배경 이미지 | 9:16으로 center-crop 해서 꽉 채움 (`cover`, 기준점 center-top). 글자 없는 원본 사용. |
| 2 | 상단 그라데이션 | 검정 35% → 투명, 화면 위 0 ~ 45% 구간. 제목 카드 가독성용. |
| 3 | 아카데미 라인 | `K-BEAUTY INFLUENCER ACADEMY` |
| 4 | 제목 카드 (블랙 카드) | 카테고리 라벨 + 스페인어 제목 2줄 + 영문 보조 1줄 |
| 5 | 대표 PiP (원형) | 아카데미 16편만. 현장 8편(대표 전체화면)은 없음 |
| 6 | 하단 브랜드 | `B2X` |

---

## 2. 좌표·크기 (1080 × 1920 기준)

### 아카데미 라인
- 텍스트: `K-BEAUTY INFLUENCER ACADEMY` (대문자 고정)
- 위치: 가로 중앙, 글자 **아래 끝 y = 278** (그리드 크롭 경계 288 바로 위, 10px 여유). 글자 범위 약 y 251~278. 틱톡 상단 탭(약 y 60~115)과는 멀리 떨어진다.
- 폰트: Bold **27px**, 자간 **6px**, 흰색, 그림자 `0 2px 12px rgba(0,0,0,.8)`
- 그리드 크롭 밖(데드존)이라 프로필 그리드에서는 보이지 않고, 릴스 재생 화면에서만 보인다. 틱톡 탭 바와 겹치지 않는다.

### 제목 카드
- 박스: **x 76 → 1004** (좌우 7% 동일 여백, 폭 928), **top y = 326** (17%). 높이는 내용에 맞춤.
- 배경 `#0D0D0D`, 모서리 **14px**, 그림자 `0 12px 36px rgba(0,0,0,.45)`
- 안쪽 여백: 상 **26** / 좌우 **30** / 하 **28**
- 왼쪽 세로 색 바: 폭 **10px**, 카드 전체 높이, 카테고리 색 (아래 표)
- 라벨: `CLASS 3 · HOT ITEM · EP.17` 형식. Bold **21px**, 자간 **3.5px**, 색 `#BDBDBD`, 대문자
- 제목(스페인어): Bold **64px**, 행간 1.12, **최대 2줄** (넘치면 문구를 줄인다, 폰트 축소 금지), 흰색
- 보조(영문): Regular **27px**, 색 `#9A9A9A`, **1줄**, 라벨과 제목 사이 간격 6, 제목과 보조 사이 10
- 3:4 그리드 크롭 경계(y = 288)보다 아래에 있어 그리드에서 잘리지 않는다.

### 대표 PiP (아카데미 16편만)
- 원형 지름 **346px** (화면 폭 32%)
- 위치: 오른쪽 끝에서 **43px** (4%), 아래 끝에서 **336px** (17.5%)
  → 원 bounding box: x 691 → 1037, y 1238 → 1584
- 테두리 흰색 **6px**, 그림자 `0 12px 32px rgba(0,0,0,.5)`
- 이미지: `assets/ceo_circle.png` (정세연 X, **윤채원 대표**. 목선·카라까지 보이게 정사각 크롭)
- 그리드 하단 크롭 경계(y = 1632)보다 위라 잘리지 않는다.
- 실제 영상에서는 이 자리에 대표 설명 영상이 원형 마스크로 들어간다.

### 하단 브랜드
- 텍스트 `B2X`, 가로 중앙, 세로 중심 **y = 1824** (하단 5%)
- Bold **27px**, 자간 **7px**, 흰색, 그림자 동일
- 데드존 안. 그리드에서는 잘린다.

---

## 3. 카테고리 색 (왼쪽 색 바)

| 코드 | 카테고리 | 라벨 예시 | 색 |
|---|---|---|---|
| `F` | 현장 · 촬영지원 8편 (대표 전체화면, PiP 없음) | `FOUNDER`, `WAREHOUSE`, `SAMPLES`, `GROUP BUY`, `INSIDE`, `STORY`, `MISTAKES`, `SEOUL` | `#E6E6E6` |
| `C1` | Class 1 · 터진 영상 분석 | `CLASS 1 · VIRAL` | `#9B6BFF` |
| `C2` | Class 2 · 핫템 고르는 법 | `CLASS 2 · PICK` | `#FF8A4C` |
| `C3` | Class 3 · 이번 주 핫템 | `CLASS 3 · HOT` | `#FF4F9A` |
| `C4` | Class 4 · K-뷰티 문화·인플루언서 | `CLASS 4 · CULTURE` | `#2FD4A8` |

라벨 끝에 항상 ` · EP.NN` (두 자리)을 붙인다.

---

## 4. 폰트

- 1순위 **Pretendard** (Bold 700 / Regular 400) — 한·영·스페인어 모두 깔끔
- 대체: **NanumSquareRound** → `NanumGothic` → 시스템 sans-serif
- 스페인어 악센트(á é í ó ú ñ ¿ ¡) 렌더 확인 필수

---

## 5. 데드존·그리드 기준 (참고)

- 릴스 재생 UI가 덮는 구간: 상단 9%, 하단 24%, 우측 16% (아이콘 열)
- 프로필 그리드 3:4 크롭: 위아래 각 **15% (288px)** 잘림
- 제목 카드와 PiP는 그리드 안에, 아카데미 라인과 B2X는 데드존(그리드 밖)에 둔다.
- 재생 화면에서 카드 오른쪽 끝이 아이콘 열과 겹치지만 제목은 왼쪽 정렬이라 글자는 가려지지 않는다.

---

## 6. 배경 이미지 촬영·선택 가이드

- 9:16, 1080×1920 이상, 글자·로고 없는 프레임
- 인물 눈높이는 화면 **50~55%** 지점 (카드가 상단 40%까지 내려오므로 그 아래)
- 현장 8편: 대표 정면 또는 약간 측면, 상반신, 배경은 편별 장소(창고·사무실·미팅룸·매장)
- 아카데미 16편: 분석 대상 영상 프레임 / 제품 컷 / 한국 인플루언서 화면. 오른쪽 아래 32%는 PiP가 가리므로 중요한 요소를 두지 않는다.

---

## 7. 사용법

```bash
# 한 장
python3 b2x-thumbnail/make_thumb.py \
  --bg path/to/background.jpg \
  --cat C3 --label "CLASS 3 · HOT" --ep 17 \
  --title "Corea lo agota cada semana. ¿Y tú?" \
  --sub "Korea's #1 sunscreen right now" \
  --out b2x-thumbnail/out/ep17.png

# 현장 편 (PiP 없음) 은 --cat F
python3 b2x-thumbnail/make_thumb.py --bg int_01.jpg --cat F --label FOUNDER --ep 1 \
  --title "No soy una marca. Soy tu proveedora en Corea." \
  --sub "I'm not a brand. I'm your Korean trader." --out out/ep01.png

# 여러 장: episodes.json 에 편별 항목을 적고
python3 b2x-thumbnail/make_thumb.py --batch b2x-thumbnail/episodes.json
```

`episodes.json` 한 항목:
```json
{"ep": 17, "cat": "C3", "label": "CLASS 3 · HOT",
 "title": "Corea lo agota cada semana. ¿Y tú?",
 "sub": "Korea's #1 sunscreen right now",
 "bg": "backgrounds/ep17.jpg", "out": "out/ep17.png"}
```

옵션: `--no-pip` (아카데미 편인데 PiP 빼고 싶을 때), `--pip assets/other.png` (다른 원형 이미지),
`--academy-text`, `--brand-text` (문구 변경), `--grid-preview` (3:4 크롭 미리보기도 같이 저장).

---

## 8. 요청할 때 알려줄 것

1. 배경 이미지 (편당 1장)
2. 카테고리 코드 (`F` / `C1` / `C2` / `C3` / `C4`) 와 라벨 문구
3. 회차 번호
4. 스페인어 제목 (2줄 안, 약 30자 이내) 과 영문 보조 (1줄)

이 네 가지만 주면 나머지는 전부 이 문서 규칙대로 고정된다.
