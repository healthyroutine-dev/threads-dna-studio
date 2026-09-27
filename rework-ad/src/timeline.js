// config(초 단위) → 프레임 단위 타임라인.
// 영상(브라우저)과 오디오·검사(Node)가 같은 계산을 쓰도록 DOM 없이 작성합니다.

const CHOSEONG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

// 한글 음절의 초성 (타이핑할 때 'ㅁ' → '뭐' 처럼 조합되는 느낌을 주기 위해)
function choseongOf(ch) {
  const c = ch.codePointAt(0);
  return c >= 0xac00 && c <= 0xd7a3 ? CHOSEONG[Math.floor((c - 0xac00) / 588)] : null;
}

// [강조] {밑줄} 표기를 뺀 순수 문장
export const plainText = (str) => str.replace(/[[\]{}]/g, '');

const SCENE_ORDER = ['hook', 'struggle', 'turn', 'value', 'setup', 'cta'];

// 입력창 컷 하나의 타이핑 → 유지 → 삭제 상태를 프레임별로 만든다.
// phase: idle(빈 칸) | typing | hold(커서 깜빡임) | erasing | selected | empty(커서가 잠깐 남았다 사라짐)
function typingScript(cut, start, end, fps) {
  const fpc = fps / (cut.speed || 15);
  const states = [];
  const events = [];
  const lines = [''];
  const spans = cut.lines.map(() => ({ appear: null, disappear: null }));
  const push = (f, phase, extra = {}) => states.push({ f, phase, lines: lines.slice(), sel: false, ...extra });

  push(start, 'idle', { blinkFrom: start });
  let t = start + 1;
  cut.lines.forEach((line, li) => {
    if (li > 0) {
      lines.push('');
      const f = Math.round(t);
      push(f, 'typing');
      events.push({ f, type: 'enter' });
      t += fpc;
    }
    for (const ch of Array.from(line)) {
      const f = Math.round(t);
      const cho = choseongOf(ch);
      const prev = lines[li];
      if (cho && fpc >= 1.9) {
        lines[li] = prev + cho;
        push(f, 'typing');
        lines[li] = prev + ch;
        push(f + 1, 'typing');
      } else {
        lines[li] = prev + ch;
        push(f, 'typing');
      }
      if (spans[li].appear === null) spans[li].appear = f;
      events.push({ f, type: ch === ' ' ? 'space' : 'key' });
      t += fpc;
    }
  });
  const typedEnd = states[states.length - 1].f;
  push(typedEnd + 1, 'hold', { blinkFrom: typedEnd + 1 });

  if (cut.erase === 'backspace') {
    let remaining = lines.reduce((n, l) => n + Array.from(l).length, 0);
    let f = end - 1 - remaining;
    while (remaining > 0) {
      const li = lines.length - 1;
      const chars = Array.from(lines[li]);
      chars.pop();
      lines[li] = chars.join('');
      remaining -= 1;
      if (lines[li] === '') spans[li].disappear = f;
      if (lines[li] === '' && lines.length > 1) lines.pop();
      push(f, remaining === 0 ? 'empty' : 'erasing', { blinkFrom: f });
      events.push({ f, type: 'backspace' });
      f += 1;
    }
  } else {
    // 전체 선택 → 삭제 → 빈 칸에서 커서가 한 번 깜빡이다 사라짐
    const selectF = end - 8;
    const deleteF = selectF + 3;
    push(selectF, 'selected', { sel: true });
    events.push({ f: selectF, type: 'select' });
    lines.length = 0;
    lines.push('');
    push(deleteF, 'empty', { blinkFrom: deleteF });
    events.push({ f: deleteF, type: 'delete' });
    spans.forEach((s) => (s.disappear = deleteF));
  }
  return { states, events, spans, typedEnd };
}

export function buildTimeline(cfg) {
  const fps = cfg.video.fps;
  const F = (sec) => Math.round(sec * fps);
  const total = Math.round(cfg.video.duration * fps);
  const S = cfg.scenes;

  const bounds = {};
  SCENE_ORDER.forEach((k, i) => {
    const next = SCENE_ORDER[i + 1];
    bounds[k] = { start: F(S[k].start), end: next ? F(S[next].start) : total };
  });

  const tl = { fps, total, bounds, scenes: {}, items: [], events: [] };
  const item = (id, text, appear, disappear, restAt) => tl.items.push({ id, text, appear, disappear, restAt });

  // ① hook
  const hook = { ...bounds.hook, textAt: F(S.hook.textAt) };
  hook.notifs = S.hook.notifications.map((n) => ({ ...n, f: F(n.at) }));
  item('hook.text', S.hook.text.join(' '), hook.textAt, hook.end, Math.min(hook.end - 2, hook.textAt + 30));
  tl.scenes.hook = hook;

  // ② struggle — 입력창 컷들 + 게시물 컷
  const postStart = F(S.struggle.post.at);
  const struggle = { ...bounds.struggle, cuts: [] };
  S.struggle.cuts.forEach((c, i) => {
    const start = F(c.at);
    const end = i + 1 < S.struggle.cuts.length ? F(S.struggle.cuts[i + 1].at) : postStart;
    const script = typingScript(c, start, end, fps);
    struggle.cuts.push({ ...c, start, end, ...script });
    script.spans.forEach((sp, li) => item(`struggle.cut${i}`, c.lines[li], sp.appear, sp.disappear, script.typedEnd + 3));
    tl.events.push(...script.events.map((e) => ({ ...e, group: 'typing' })));
  });
  struggle.post = { ...S.struggle.post, start: postStart, end: struggle.end };
  tl.scenes.struggle = struggle;

  // ③ turn — 레드 라인 → 화면 분할 → 헤드라인 → 4단계
  const t0 = bounds.turn.start;
  const turn = {
    ...bounds.turn,
    lineDraw: [t0, t0 + 5], // 레드 라인이 왼쪽→오른쪽으로 그어짐
    split: [t0 + 5, t0 + 17], // 검은 화면이 위/아래로 갈라짐
    morph: [t0 + 14, t0 + 28], // 레드 라인이 편집 룰(구분선)로 자리 잡음
    headlineAt: F(S.turn.headlineAt),
    stepsAt: S.turn.stepsAt.map(F),
    exit: bounds.turn.end, // 10초 박자에 하드컷 — '스토리' 만 남아 슬로건으로 날아간다
  };
  item('struggle.post', S.struggle.post.text, postStart + 1, turn.split[0] + 6, t0 - 6);
  item('turn.headline', S.turn.headline.join(' '), turn.headlineAt, turn.end, turn.stepsAt[turn.stepsAt.length - 1] + 14);
  turn.stepsAt.forEach((f, i) =>
    item(`turn.step${i}`, S.turn.steps[i], f, turn.end, turn.stepsAt[turn.stepsAt.length - 1] + 14),
  );
  tl.scenes.turn = turn;

  // ④ value / setup
  // 크림 파트의 장면 전환은 모두 박자에 맞춘 하드컷 (나가는 글자와 들어오는 글자가 겹치지 않게)
  const value = { ...bounds.value };
  item('value.slogan', plainText(S.value.slogan.join(' ')), value.start, value.end, value.start + 18);
  tl.scenes.value = value;
  const setup = { ...bounds.setup };
  item('setup.lines', plainText(S.setup.lines.join(' ')), setup.start + 2, setup.end, setup.start + 26);
  tl.scenes.setup = setup;

  // ⑤ cta
  const c0 = bounds.cta.start;
  const cta = {
    ...bounds.cta,
    logoAt: c0 + 2,
    colonAt: c0 + 5,
    buttonAt: c0 + 12,
    urlAt: c0 + 20,
    pressAt: F(S.cta.pressAt),
  };
  item('cta.logo', Object.values(S.cta.logo).join(''), cta.logoAt, total, cta.urlAt + 12);
  item('cta.button', S.cta.button, cta.buttonAt, total, cta.urlAt + 12);
  item('cta.url', S.cta.url, cta.urlAt, total, cta.urlAt + 12);
  tl.scenes.cta = cta;

  // 오디오 큐 (프레임)
  tl.events.push({ f: turn.lineDraw[0], type: 'transition', group: 'sfx' });
  turn.stepsAt.forEach((f, i) => tl.events.push({ f, type: 'step', index: i, group: 'music' }));
  tl.events.push({ f: cta.colonAt, type: 'cta', group: 'sfx' });
  tl.events.push({ f: cta.pressAt, type: 'tap', group: 'sfx' });
  tl.events.sort((a, b) => a.f - b.f);

  return tl;
}

// 노출 시간·장면 순서 검사
export function validate(cfg, tl) {
  const minF = Math.round(cfg.rules.minReadSec * tl.fps);
  const errors = [];
  const rows = tl.items.map((it) => {
    const frames = it.disappear - it.appear;
    return { ...it, frames, sec: frames / tl.fps, ok: frames >= minF };
  });
  rows.filter((r) => !r.ok).forEach((r) => errors.push(`노출 ${r.sec.toFixed(2)}초 < ${cfg.rules.minReadSec}초: "${r.text}"`));
  SCENE_ORDER.forEach((k) => {
    const b = tl.bounds[k];
    if (!(b.end > b.start)) errors.push(`장면 순서 오류: ${k} (${b.start}~${b.end}프레임)`);
  });
  if (tl.bounds.cta.end !== tl.total) errors.push('마지막 장면이 영상 길이와 맞지 않습니다');
  return { rows, errors, ok: errors.length === 0 };
}
