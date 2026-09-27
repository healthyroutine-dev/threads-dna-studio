// ============================================================================
//  RE:WORK STUDIO — 15초 광고 영상 설정 파일
//  문구·타이밍·컬러는 전부 이 파일에만 있습니다. 고친 뒤 `npm run render` 하면
//  out/rework_ad_15s_9x16.mp4 가 다시 만들어집니다.
// ----------------------------------------------------------------------------
//  · 시간 단위는 모두 '초'입니다. 30fps 기준으로 자동 변환됩니다.
//    (1초 = 30프레임 / BGM 120BPM → 1박 = 0.5초. 박자에 맞추려면 0.25초 단위 권장)
//  · 장면은 다음 장면의 start 에서 끝납니다. 마지막 장면은 video.duration 에서 끝납니다.
//  · 문구 표기법
//      [단어]  → 빨간 대괄호 강조 (랜딩 페이지 히어로의 [스토리] 와 같은 스타일)
//      {단어}  → 빨간 밑줄 강조
//  · 렌더 전에 자동 검사합니다: 문장 노출 1.2초 미만, 인스타 UI 영역 침범, 폭 넘침
//    (`npm run check` 로 검사만 따로 돌릴 수 있습니다)
//  · 컬러·폰트·로고·주소는 https://rework-studio.vercel.app 의 디자인 토큰에서 가져왔습니다.
// ============================================================================

export default {
  video: {
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 15, // 초 (정확히 450프레임)
    output: 'out/rework_ad_15s_9x16.mp4',
    crf: 16, // 화질: 낮을수록 고화질 (16~20 권장)
  },

  // 랜딩 페이지 토큰: --ink / --canvas / --primary (값이 기획서 3색과 동일)
  colors: {
    ink: '#0F0F0F', // 딥 블랙 — 전반부 배경, 전환 후 글자
    cream: '#F3EFE4', // 크림 — 전반부 글자, 전환 후 배경
    red: '#FF2D2D', // 비비드 레드 — 포인트 전용 (7초 전환부터 등장)
  },

  // 랜딩 페이지 --font-sans 와 동일. 고딕 계열만 사용합니다.
  font: {
    family: 'Pretendard Variable',
  },

  rules: {
    minReadSec: 1.2, // 한 문장 최소 노출 시간
    safeTop: 250, // 인스타 상단 UI 영역 — 핵심 텍스트 금지 (px)
    safeBottom: 350, // 인스타 하단 UI 영역 — 핵심 텍스트 금지 (px)
    safeSide: 64, // 좌우 여백 (px) — 메타 권장 약 6%
  },

  scenes: {
    // ① 0~2.5초 [후킹/공감] 바쁜 대표님의 하루 — 알림이 쌓이는 모션 위에 한 문장
    hook: {
      start: 0,
      text: ['SNS, 해야 하는 건', '아는데…'], // 줄 단위로 나눠 적습니다
      textAt: 0.13,
      clock: { label: '오늘', from: '09:00', to: '23:47' },
      // at: 알림이 도착하는 시간(초). highlight: true 면 더 밝게 강조
      notifications: [
        { at: 0.0, app: '메시지', icon: 'chat', title: '견적서 요청 1건' },
        { at: 0.25, app: '캘린더', icon: 'calendar', title: '14:00 거래처 미팅' },
        { at: 0.5, app: '메일', icon: 'mail', title: '세금계산서 발행 요청' },
        { at: 0.75, app: '미리 알림', icon: 'check', title: 'SNS 게시물 올리기 · 3일째', highlight: true },
        { at: 1.0, app: '메시지', icon: 'chat', title: '답장 기다리는 문의 7건' },
        { at: 1.25, app: '캘린더', icon: 'calendar', title: '19:00 강의 자료 준비' },
        { at: 1.5, app: '미리 알림', icon: 'check', title: '릴스 기획하기', highlight: true },
        { at: 1.75, app: '메일', icon: 'mail', title: '이번 달 정산 내역 확인' },
        { at: 2.0, app: '메시지', icon: 'chat', title: '새 문의 3건' },
      ],
    },

    // ② 2.5~7초 [막막함] 고민을 타이핑했다 지우는 빠른 컷
    struggle: {
      start: 2.5,
      composer: {
        title: '새 게시물',
        action: '공유',
        media: '사진·영상 추가',
        label: '문구 입력',
        maxChars: '2,200',
      },
      // 컷마다: at(시작초), lines(타이핑할 줄), speed(초당 글자수),
      //         erase: 'backspace'(한 글자씩 지움) | 'selectAll'(전체 선택 후 삭제)
      //         zoom: 입력창을 크게 당겨 보여줄 배율 (빠른 컷 느낌)
      cuts: [
        { at: 2.5, lines: ['뭐부터 올리지?'], speed: 15, erase: 'backspace', zoom: 1 },
        { at: 4.0, lines: ['컨셉은?', '스토리는?'], speed: 30, erase: 'selectAll', zoom: 1.32 },
      ],
      // 올려놓은 게시물 — 낮은 조회수가 천천히 오르다 멈춤 (대표님 계정 상황 묘사용 숫자)
      post: {
        at: 5.6,
        text: '올려놓고 보면… 아쉽고',
        label: '게시물 인사이트',
        views: [12, 37], // 시작 → 멈추는 조회수
        likes: 2,
        comments: 0,
      },
    },

    // ③ 7~10초 [전환] 비비드 레드 라인이 화면을 가르고 크림 톤으로 정돈
    turn: {
      start: 7.0,
      marker: { no: '02', ko: '전환', en: 'THE TURN' },
      headline: ['혼자', '애쓰지 마세요'],
      headlineAt: 7.33,
      // 리워크 방식 4단계 (랜딩 페이지 '03 방식 — The Method' 와 동일)
      stepsMarker: { no: '03', ko: '방식', en: 'THE METHOD' },
      stepLabel: 'STEP',
      steps: ['정리', '언어화', '스토리', '자산'],
      stepsAt: [8.0, 8.25, 8.5, 8.75],
    },

    // ④ 10~11.5초 [가치] 랜딩 페이지 슬로건
    value: {
      start: 10.0,
      marker: 'RE:WORK STUDIO — CONTENT BRANDING',
      // [스토리] 는 ③의 STEP '스토리' 가 날아와 자리 잡는 매치컷으로 연결됩니다 (같은 단어일 때)
      slogan: ['선택받는 브랜드는', '운이 아니라', '[스토리]입니다'],
    },

    // ④ 11.5~13초 [가치] 행동 제안
    setup: {
      start: 11.5,
      lines: ['올해가 가기 전에,', '내 SNS {제대로 세팅}'],
    },

    // ⑤ 13~15초 [CTA] 로고 타이포 + 신청 버튼 + 배포 주소
    cta: {
      start: 13.0,
      logo: { left: 'RE', colon: ':', right: 'WORK', suffix: 'STUDIO' },
      button: '무료 계정 분석 신청',
      url: 'rework-studio.vercel.app',
      pressAt: 14.27, // 버튼이 살짝 눌리는 순간
    },
  },

  audio: {
    enabled: true,
    bpm: 120, // 1박 = 0.5초 = 15프레임
    sampleRate: 48000,
    loudness: -16, // 최종 음량 (LUFS). SNS 권장 -14 ~ -16
    volume: { music: 1.0, sfx: 1.0, typing: 0.7 },
    // 효과음 켜고 끄기
    sfx: {
      transition: true, // 7초 레드 라인 스우시 + 벨
      cta: true, // 로고 등장 차임
      typing: true, // 타이핑 소리 (작게)
      tap: true, // 버튼 눌림
    },
  },
};
