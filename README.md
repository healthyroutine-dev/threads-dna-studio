# 🧬 스레드 DNA 스튜디오

내 스레드(Threads) 계정을 연결하면 → 전체 글·성과를 수집하고 → **나만의 콘텐츠 DNA(말투·잘되는 폼·약점)를 자동 추출**해서 → 그 DNA로 글감 제안·초안 작성·발행 전 예측까지 해주는 웹앱.

## 목업 모드 (환경변수 없이 바로 실행)

환경변수를 하나도 설정하지 않아도 전체 기능이 목업 데이터로 동작합니다.

```bash
npm install
npm run dev
```

http://localhost:3000 접속 → **[목업 계정으로 시작하기]** → 아카이브에서 [전체 동기화] → DNA 탭에서 [DNA 추출하기] → 쓰기 탭에서 글감 받기.

| 환경변수 | 없을 때 (목업) | 있을 때 (실연동) |
|---|---|---|
| `THREADS_APP_ID/SECRET` | 가짜 계정 + 목업 글 60개·통계 | 실제 Threads OAuth·API |
| `ANTHROPIC_API_KEY` | 규칙 기반 목업 AI 응답 | Claude (claude-sonnet-4-6) |
| `DATABASE_URL` | 로컬 `.data/store.json` 파일 | Postgres (Vercel Postgres/Neon) |

세 축은 독립적이라 일부만 실제 키를 넣어도 됩니다. (예: AI 키만 넣으면 목업 글을 실제 Claude로 분석)

## 실제 연동 설정 (비개발자용 순서)

### 1. Meta 앱 만들기 (PC에서)
1. [developers.facebook.com](https://developers.facebook.com) → 내 앱 → 앱 만들기 → 사용 사례에서 **Threads API** 선택
2. 앱 설정 → 기본 설정에서 **앱 ID / 앱 시크릿** 확인
3. Threads API 사용 사례 설정에서 권한 추가: `threads_basic`, `threads_manage_insights`, (발행 기능을 쓰려면) `threads_content_publish`
4. **리디렉션 URI** 등록: `https://<내 도메인>/api/auth/callback`
5. 역할 → **테스터로 본인 스레드 계정 등록** (베타 단계에선 이걸로 충분 — 앱 심사 전에는 테스터만 로그인 가능)

### 2. Vercel 배포
1. 이 저장소를 GitHub에 두고 [vercel.com](https://vercel.com)에서 Import
2. Storage 탭에서 Postgres(또는 Neon) 연결 → `DATABASE_URL` 자동 주입
3. 환경변수 입력 (`.env.example` 참고):
   - `THREADS_APP_ID`, `THREADS_APP_SECRET`, `THREADS_REDIRECT_URI`
   - `ANTHROPIC_API_KEY` ([console.anthropic.com](https://console.anthropic.com)에서 발급)
   - `SESSION_SECRET` (아무 긴 랜덤 문자열)
   - `AI_DAILY_LIMIT` (선택, 기본 30 — 유저별 일일 AI 호출 한도)
4. 배포 → 본인 계정으로 실테스트 → 지인 테스터는 Meta 앱에 테스터로 추가

토큰은 60일 장기 토큰으로 저장되며, 매일 새벽 cron(`vercel.json`)이 만료 7일 전 토큰을 자동 갱신합니다.

### 3. 공개 배포 전 (2단계)
- Meta 앱 심사(advanced access) 통과 필요: 권한별 사용 목적 설명 + 시연 영상, 개인정보처리방침·서비스 약관 URL
- 개인정보: 토큰 암호화 저장, 탈퇴 시 데이터 삭제 라우트(Meta Data Deletion Callback) 구현
- Anthropic 호출량 모니터링 → 유료 플랜(`users.plan`) 전환 시점 판단

## 구조

- **홈** — 팔로워 현황(전일 대비), DNA 카드 요약, 오늘의 글감, DNA 업데이트 배지
- **DNA** — 추출된 DNA 열람·항목별 인라인 수정·다시 추출·추출 근거(히트작 TOP10)
- **쓰기** — 글감 5개(축 라벨) → 초안 → AI 자연어 수정 → 예측·개선 → 발행/기록
- **아카이브** — 검색·정렬, 인기 TOP10, 동기화 4종(전체/글만/최신만/통계만) + 진행률
- **성장** — 팔로워 차트(방문 시 자동 스냅샷), 일별 변화, AI 진단

기술: Next.js 15 (App Router) · Tailwind v4 · Postgres(pg) 또는 파일 저장소 · Anthropic API. AI는 서버 라우트에서만 호출하고 모든 라우트에 해당 유저의 DNA를 주입합니다.