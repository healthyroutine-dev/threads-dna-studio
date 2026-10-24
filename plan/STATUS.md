# 진행 현황 · 이어서 할 일 (2026-10-24)

규칙: `plan/EDIT_RULES.md` · 도구: `plan/pipeline/` · 결과: `plan/final/NNN/`

| 편 | 촬영본 | 제목 ES / KO | 진행 | 대본과 다른 줄 |
|---|---|---|---|---|
| 001 | 0001 | Ni una palabra. 5,4 M de vistas. / 말 한마디 없이. 조회수 540만. | 더빙 · 보정 · 최종폴더 |  |
| 002 | 0002 | 311 seguidores. 1,9 M de vistas. / 팔로워 311명. 조회수 190만. | prep · 제목·자막 · 더빙 · 보정 · 최종폴더 | ⚠ |
| 003 | 0003 | 99 mil guardados. Para comprar. / 저장 9만 9천. 사려고 저장. | prep · 제목·자막 · 더빙 · 보정 |  |
| 004 | 0004 | 9 mil seguidores. 4,2 M de vistas. / 팔로워 9천. 조회수 420만. | prep · 제목·자막 · 더빙 · 보정 |  |
| 005 | 0005 | Su piel empeoró. 357 mil likes. / 피부가 나빠졌는데. 좋아요 35만. | prep · 제목·자막 · 더빙 · 보정 |  |
| 006 | 0006 | Una mala reseña. 2,2 M de vistas. / 나쁜 후기 하나. 조회수 220만. | prep · 제목·자막 · 더빙 · 보정 |  |
| 007 | 0007 | Líneas blancas. 1,5 M de vistas. / 얼굴에 하얀 줄. 조회수 150만. | prep · 제목·자막 · 더빙 |  |
| 008 | 0008 | Le dijo «no». 89 mil guardados. / 인기 브랜드에 "노". 저장 8만 9천. | prep · 제목·자막 · 더빙 |  |
| 009 | 0009 | Solo 3 pasos. 10 M de vistas. / 딱 3단계. 조회수 천만. | prep · 제목·자막 · 더빙 |  |
| 010 | 0010 | Solo sonidos. 1,9 M de vistas. / 소리만. 조회수 190만. | prep · 제목·자막 · 더빙 |  |
| 011 | 0011 | 2 min de chisme. 1,1 M de likes. / 2분 수다. 좋아요 110만. | prep · 제목·자막 · 더빙 |  |
| 012 | 0012 | 909 mil vistas. Y ya da dinero. / 조회수 91만. 그런데 벌써 돈을 번다. | prep · 제목·자막 · 더빙 |  |
| 013 | 0013 | 12 segundos. 75 veces más. / 12초. 좋아요 평소의 75배. | prep | ⚠ |
| 014 | 0015 | 1,2 M de vistas. Y es su promedio. / 조회수 120만. 그런데 평소 성적. | prep | ⚠ |
| 015 | 0016 | Una sola foto. 186 K guardados. / 사진 한 장. 저장 18만 6천. | prep |  |
| 016 | 0017 | Un problema. 29 veces más. / 고민 하나. 좋아요 평소의 29배. | prep | ⚠ |
| 017 | 0018 | 56 segundos. 8,8 M de vistas. / 56초. 조회수 880만. | prep |  |
| 018 | 0019 | Una sola frase. 40 veces más. / 첫 문장 하나. 좋아요 평소의 40배. | prep |  |
| 019 | 0020 | Crema conocida. 11,5 M de vistas. / 다 아는 크림. 조회수 1150만. | prep | ⚠ |
| 020 | 0021 | 36,6 M de vistas. Solo el doble. / 조회수 3660만. 평소의 2배뿐. | prep |  |
| 021 | 0023 | 7 mil seguidores. 45 veces más. / 팔로워 7천. 좋아요 평소의 45배. | prep | ⚠ |
| 022 | 0024 | 8 segundos. 5 pasos. / 8초. 다섯 단계. | prep | ⚠⚠ |
| 023 | 0025 | Misma creadora. 15 veces más. / 같은 크리에이터. 평소의 15배. | prep | ⚠ |
| 024 | 0026 | Mismo formato. 58 veces más. / 같은 포맷. 좋아요 평소의 58배. | prep | ⚠⚠ |
| 025 | 0027 | Piel de clienta. 13 veces más. / 손님 피부. 좋아요 평소의 13배. | prep | ⚠ |
| 026 | 0028 | 5,7 M de vistas. No te lo creas. / 조회수 570만. 믿지 마세요. | prep | ⚠ |

## 다음 할 일
1. 002: 배지 "02 · SIN HABLAR"로 고친 뒤 es·ko 다시 빌드 → `ep_final.py 002` → 전달 (override에 labels·subs 반영 완료, 빌드 미완)
2. 003~006: 보정·더빙 완료 → build_ep es/ko → ep_final → 전달
3. 007~012: 보정 대기열 진행 중(컨테이너 재시작 시 `beauty_queue.sh` 다시 실행, 완료된 편은 건너뜀) → build → 전달
4. 013~026: report.txt ⚠ 줄 확인 → override(es 수정·CTA 변경·SECT 경계 보정) → plan → tts → 보정 → build
   - 013 CTA 앞에 "말은 없어도 돼요" 섞임(경계), 016 CTA 바뀜("피부 고민별 추천 제품"), 019 03 뒷문장 생략,
     021 03 숫자 문장 생략, 022·024·025 경계 오매칭 확인, 023 02 "014편" 언급 생략, 026 02 표현 변경
5. 편마다: 제목은 한국어-스페인어로 보고, 업로드 문구는 드라이브 "편집완"에 문서로
