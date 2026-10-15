# 001 · 대표 영상 삽입 큐시트 (스페인어 더빙 + 스페인어 자막)

릴스: `b2x_kbeauty_que_vende_001_es_dub.mp4` (1080×1920, 57.2초). 원본이 멈춘 구간마다 오른쪽 위 원형 자리(점선 원)에 채원 대표 영상이 들어간다.

- 자리: 지름 346px 원형, x 691 · y 640 (헤더 아래 오른쪽). 썸네일 PiP와 같은 크기
- 지금 음성은 길이를 맞추려고 넣은 **임시 스페인어 AI 음성**(es-MX). 화면 자막 = 더빙 문장
- **정식본 만드는 법 (권장):** 대표가 아래 EN 문장을 카메라 보고 녹화 → 립싱크 번역 툴(HeyGen 계열)로 대표 목소리 그대로 스페인어 변환 → ES 문장과 대조해 원어민 검수 → `template/build3.py`에 녹음을 넣고 다시 빌드(정지 길이가 자동으로 맞춰짐)
- 대안: 대표 사진(정지 이미지)을 원에 넣고 스페인어 음성만 사용 (입 모양 문제 없음)
- 촬영: 세로, 얼굴과 어깨, 정면, 단색 배경. 문장마다 앞뒤 1초 여유

| 구간 | 최종 영상 시간 | 길이 | 스페인어 더빙·자막 (ES) | 대표 녹화용 원문 (EN) |
|---|---|---|---|---|
| HOOK | 00:00.50 – 00:06.43 | 5.9초 | Cero palabras. 5,4 millones de vistas. Mira lo que le falta. | Zero words. 5.4 million views. Here's what it got right, and what it's missing. |
| 01 | 00:07.43 – 00:11.67 | 4.2초 | Uno: 'sin filtro' todo el tiempo. Adiós a la duda. | One: 'No filter' stays on screen the whole time. Doubt is gone before it starts. |
| 02 | 00:13.17 – 00:20.83 | 7.7초 | Dos: el problema, escrito. Rojez, manchas, arrugas. Si eres tú, te quedas. | Two: the problem, in writing. Redness, melasma, wrinkles. If that's you, you stop. |
| 03 | 00:23.43 – 00:28.57 | 5.1초 | Tres: solo antes y después. Diez segundos: lo ven dos veces. | Three: just before and after. Ten seconds, so people watch it twice. |
| 04 | 00:30.47 – 00:37.00 | 6.5초 | Tu turno: copia el antes y después, pero con tu voz. Mira a la cámara: qué usaste y por qué. | Your turn: copy the before and after, but add your voice. Look at the camera and say what you used and why. |
| 05 | 00:38.50 – 00:47.43 | 8.9초 | Vistas no son ventas. Hablar vende. Una creadora con 5.300 seguidores vendió hasta 60 mil dólares en TikTok Shop. | Views aren't sales. Talking videos sell. One creator with 5,300 followers made 25 to 60 thousand dollars on TikTok Shop. |
| FÓRMULA | 00:48.30 – 00:57.23 | 8.9초 | Sin filtro, problema primero, y tu voz. Soy Chaewon, desde Seúl. Comenta ACADEMY y te mando la lista de esta semana. | No filter, problem first, then your voice. I'm Chaewon in Seoul. Comment ACADEMY and I'll send you this week's sourcing list. |

## TikCle 플레이북 반영
- 04: 전후만 따라 하지 말고 목소리를 넣으라 (말하는 영상이 가장 강하고, 목소리 없는 전후 영상은 효율이 낮음)
- 05: 조회수 ≠ 매출 + 나노 근거 (팔로워 5.3K, 미국 틱톡샵 누적 $25K–60K 구간. 자막의 '최대 6만 달러'는 이 구간의 상단)
- CTA: 판매 대신 가치 제안 ("이번 주 리스트 보내드려요"), 국가·판매처 언급 없음
