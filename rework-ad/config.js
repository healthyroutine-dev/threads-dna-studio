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
    // ① 0~2.5초 [후킹] 첫 프레임부터 타깃을 부른다.
    //    업무 알림이 쌓이는 동안 'SNS 게시물 올리기' 알림만 계속 미뤄진다 (→ '늘 뒷전')
    hook: {
      start: 0,
      text: ['혼자 사업하는 대표님,', 'SNS는 늘 뒷전이죠?'], // 줄 단위로 나눠 적습니다
      textAt: -0.4, // 음수 = 영상 시작 전에 등장이 끝나 첫 프레임(썸네일)부터 문장이 보임
      lineGap: 0.47, // 둘째 줄은 이만큼 늦게 (첫 줄을 먼저 읽도록)
      clock: { label: '오늘', from: '09:00', to: '23:47' },
      // at: 알림이 도착하는 시간(초, 음수면 첫 프레임에 이미 도착). highlight: true 면 밝게 강조
      notifications: [
        { at: -0.25, app: '메시지', icon: 'chat', title: '견적서 요청 1건' },
        { at: 0.0, app: '미리 알림', icon: 'check', title: 'SNS 게시물 올리기', highlight: true },
        { at: 0.25, app: '캘린더', icon: 'calendar', title: '14:00 거래처 미팅' },
        { at: 0.5, app: '메일', icon: 'mail', title: '세금계산서 발행 요청' },
        { at: 0.75, app: '메시지', icon: 'chat', title: '답장 기다리는 문의 7건' },
        { at: 1.0, app: '미리 알림', icon: 'check', title: 'SNS 게시물 올리기 · 다시 알림', highlight: true },
        { at: 1.25, app: '캘린더', icon: 'calendar', title: '19:00 강의 자료 준비' },
        { at: 1.5, app: '메일', icon: 'mail', title: '이번 달 정산 내역 확인' },
        { at: 1.75, app: '메시지', icon: 'chat', title: '새 문의 3건' },
        { at: 2.0, app: '미리 알림', icon: 'check', title: 'SNS 게시물 올리기 · 3일째 미룸', highlight: true },
      ],
    },

    // ② 2.5~7초 [공감] 고민을 타이핑했다 지우는 빠른 컷 → 올려도 조용한 반응
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
      // 올린 게시물 — 조회수가 천천히 오르다 멈춤 (대표님 계정 상황을 보여주는 연출용 숫자)
      post: {
        at: 5.6,
        text: '올려도… 반응은 조용하고',
        label: '게시물 인사이트',
        views: [12, 37], // 시작 → 멈추는 조회수
        likes: 2,
        comments: 0,
      },
    },

    // ③ 7~10초 [전환·안도] 레드 라인이 화면을 가르고 크림 톤으로 정돈.
    //    ②에서 고민하던 질문들이 체크리스트로 돌아와 박자마다 체크된다
    turn: {
      start: 7.0,
      headline: ['혼자 애쓰지 마세요,', '같이 정리해드릴게요'],
      headlineAt: 7.33,
      lineGap: 0.3,
      checklist: ['뭐부터 올릴지', '컨셉', '스토리'],
      listAt: 7.9, // 체크 전 목록이 먼저 흐리게 나타나는 시점
      checkAt: [8.25, 8.5, 8.75], // 항목마다 빨간 체크 (벨 소리가 함께 오름)
    },

    // ④ 10~11.5초 [신뢰] 랜딩 페이지의 '1:1 · 전 과정 대표 직접 진행'
    trust: {
      start: 10.0,
      badge: '1:1', // 가운데 콜론은 로고와 같은 빨간 박스로 그립니다
      lines: ['처음부터 끝까지,', '대표가 직접 함께해요'],
    },

    // ④ 11.5~13초 [제안] 올해가 가기 전에 (재촉하지 않고 권하는 톤)
    setup: {
      start: 11.5,
      lines: ['올해가 가기 전에,', '내 SNS {제대로 세팅}'],
    },

    // ⑤ 13~15초 [CTA] 로고 + 무료 상담 버튼 + 안심 문구 + 주소
    cta: {
      start: 13.0,
      logo: { left: 'RE', colon: ':', right: 'WORK', suffix: 'STUDIO' },
      button: '무료 상담하기',
      note: '상담만 받아도 괜찮아요', // 랜딩: '상담은 무료이며 계약으로 이어지지 않습니다'
      url: 'rework-studio.vercel.app',
      pressAt: 14.27, // 버튼이 살짝 눌리는 순간
    },
  },

  // 전환 이후 화면 상단에 계속 보이는 브랜드 표기 (랜딩 히어로의 빨간 점 + 문구)
  brand: {
    marker: 'RE:WORK STUDIO — CONTENT BRANDING',
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
      check: true, // 체크리스트 체크 소리
      cta: true, // 로고 등장 차임
      typing: true, // 타이핑 소리 (작게)
      tap: true, // 버튼 눌림
    },
  },
};
