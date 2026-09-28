// config(초 단위) → 프레임 단위 타임라인.
// 영상(브라우저)과 오디오·검사(Node)가 같은 계산을 쓰도록 DOM 없이 작성합니다.

// {밑줄} 표기를 뺀 순수 문장
export const plainText = (str) => str.replace(/[{}]/g, '');

export const SCENE_ORDER = ['hook', 'punch', 'cause', 'answer', 'show', 'heart', 'cta'];

export function buildTimeline(cfg) {
  const fps = cfg.video.fps;
  const F = (sec) => Math.round(sec * fps);
  // 말에 맞춘 화면 이벤트는 내림: 화면이 소리보다 늦지 않게 (눈은 소리가 먼저 오는 어긋남에 더 민감)
  const FV = (sec) => Math.floor(sec * fps + 1e-6);
  const total = Math.round(cfg.video.duration * fps);
  const S = cfg.scenes;

  const bounds = {};
  SCENE_ORDER.forEach((k, i) => {
    const next = SCENE_ORDER[i + 1];
    bounds[k] = { start: F(S[k].start), end: next ? F(S[next].start) : total };
  });

  // items: 읽어야 하는 문장 (노출 시간·세이프존 검사용. appear = 문장 전체가 다 보이는 순간)
  // events: 소리 신호 (t 가 있으면 그 시각(초)에 정확히, 없으면 프레임 시각에), shakes: 화면 흔들림
  // voice: 내레이션 배치 (녹음 구간 from~to 를 영상의 at 초에)
  const tl = { fps, total, bounds, scenes: {}, items: [], events: [], shakes: [], voice: [] };
  const item = (id, text, appear, disappear, restAt) => tl.items.push({ id, text, appear, disappear, restAt });
  const ev = (f, type, extra = {}) => tl.events.push({ f, type, ...extra });
  const shake = (f, amp, dur) => tl.shakes.push({ f, amp, dur });
  const wordsOf = (lines) => lines.join(' ').split(/\s+/).filter(Boolean);
  // 자막 등장: 단어마다 stagger 프레임, 줄이 바뀔 때 lineGap 프레임 더. full = 문장 전체가 다 보이는 프레임
  const reveal = (lines, at, stagger, lineGap, settle = 2) => ({
    at,
    stagger,
    lineGap,
    full: at + (wordsOf(lines).length - 1) * stagger + (lines.length - 1) * lineGap + settle,
  });

  // 장면 k 의 음성이 시작하는 시각(초) + rel. 목소리 없는 버전도 화면 타이밍은 같다
  const vAt = (k, rel = 0) => S[k].start + (S[k].voice?.delay ?? 0) + rel;
  for (const k of SCENE_ORDER) {
    const v = S[k].voice;
    if (v) tl.voice.push({ id: k, from: v.from, to: v.to, at: vAt(k), end: vAt(k) + (v.to - v.from) });
  }

  // ① hook — 결제 알림이 쏟아진다 (textAt 이 음수면 첫 프레임에 이미 문장이 떠 있다)
  const hook = { ...bounds.hook, reveal: reveal(S.hook.text, F(S.hook.textAt), 2, F(S.hook.lineGap ?? 0)) };
  hook.pays = S.hook.payments.map((p) => ({ ...p, f: F(p.at) }));
  const hookShown = Math.max(hook.start, hook.reveal.full);
  item('hook.text', S.hook.text.join(' '), hookShown, hook.end, Math.min(hook.end - 2, hookShown + 12));
  ev(hook.start, 'impact');
  hook.pays.filter((p) => p.f >= hook.start).forEach((p) => ev(p.f, 'pay'));
  tl.scenes.hook = hook;

  // ① punch — 음악이 멈추고, 말하는 단어마다 쾅 (줄의 첫 단어에서 그 줄 전체가 떨어진다)
  const punch = { ...bounds.punch };
  const words = wordsOf(S.punch.text);
  const wordAt = S.punch.wordAt ?? words.map((_, i) => i * 0.25);
  punch.wordT = words.map((_, i) => vAt('punch', wordAt[Math.min(i, wordAt.length - 1)]));
  punch.words = punch.wordT.map(FV);
  punch.lineFirst = [];
  S.punch.text.reduce((n, line) => {
    punch.lineFirst.push(n);
    return n + wordsOf([line]).length;
  }, 0);
  const punchFull = punch.words[punch.lineFirst[punch.lineFirst.length - 1]];
  item('punch.text', S.punch.text.join(' '), punchFull, punch.end, punch.end - 2);
  // 화면에만 나오는 지출 목록: 둘째 줄이 박힌 뒤부터 하나씩, 조금 뒤부터 목록 전체가 위로 스크롤
  const moreFrom = punchFull + 5;
  const moreEvery = Math.max(1, F(S.punch.moreEvery ?? 0.13));
  punch.more = (S.punch.more ?? []).map((_, k) => moreFrom + k * moreEvery).filter((f) => f < punch.end);
  punch.scrollFrom = moreFrom + 6;
  punch.more.forEach((f, k) => ev(f, 'tick', { index: k }));
  punch.words.forEach((f, i, all) => {
    const last = i === all.length - 1;
    const lineHit = punch.lineFirst.includes(i);
    ev(f, 'hit', { big: last, soft: !last && !lineHit, t: punch.wordT[i] });
    shake(f, last ? 24 : lineHit ? 14 : 7, last ? 9 : 5);
  });
  tl.scenes.punch = punch;

  // ① cause — 휩팬으로 내 계정 → 말에 맞춰 '게시물 0' 줌 펀치
  const cause = { ...bounds.cause };
  cause.reveal = reveal(S.cause.text, Math.max(cause.start + 3, FV(vAt('cause')) - 2), 2, 5);
  cause.zoomT = vAt('cause', S.cause.zoomAt ?? 0.3);
  cause.zoomAt = FV(cause.zoomT);
  ev(cause.start, 'whip');
  ev(cause.zoomAt, 'thump', { t: cause.zoomT });
  shake(cause.zoomAt, 7, 5);
  tl.scenes.cause = cause;

  // ② answer — 드롭: 레드 라인이 화면을 가르고(분할) 밑줄로 자리 잡는다
  const a0 = bounds.answer.start;
  const answer = {
    ...bounds.answer,
    lineDraw: [a0, a0 + 5],
    split: [a0 + 5, a0 + 17],
    morph: [a0 + 15, a0 + 28],
    reveal: reveal(S.answer.text, a0 + 8, 2, 3),
  };
  item('cause.text', S.cause.text.join(' '), cause.reveal.full, answer.split[0] + 4, a0 - 3);
  item('answer.text', plainText(S.answer.text.join(' ')), answer.reveal.full, answer.end, answer.end - 3);
  ev(a0, 'drop');
  shake(a0, 14, 7);
  tl.scenes.answer = answer;

  // ③ show — 같은 계정이 정리되며 채워진다
  const show = { ...bounds.show, reveal: reveal(S.show.text, bounds.show.start + 1, 2, 4) };
  item('show.text', plainText(S.show.text.join(' ')), show.reveal.full, show.end, show.end - 3);
  show.tiles = cfg.profile.tiles.map((_, i) => F(S.show.start + 0.1 + i * S.show.tileEvery));
  show.tiles.forEach((f, i) => ev(f, 'tile', { index: i }));
  tl.scenes.show = show;

  // ④ heart — 강의 카드가 쌓이고 하나씩 '수강 완료' → CTA 직전에 위로 날아간다(꺼내기)
  const c0 = bounds.cta.start;
  const n = Math.min(S.heart.cards, S.hook.payments.length);
  const heart = { ...bounds.heart };
  heart.reveal = reveal(S.heart.text, Math.max(heart.start + 2, FV(vAt('heart')) - 2), 3, 4, 6);
  heart.lands = Array.from({ length: n }, (_, i) => heart.start - 4 + i * 5); // 컷 직전부터 떨어지기 시작
  heart.stamps = Array.from({ length: n }, (_, i) => F(S.heart.start + 0.5 + i * 0.25));
  heart.flies = Array.from({ length: n }, (_, i) => c0 - 9 + i * 2);
  item('heart.text', plainText(S.heart.text.join(' ')), heart.reveal.full, heart.end, heart.end - 3);
  heart.lands.forEach((f) => ev(f + 7, 'land')); // 카드가 닿는 순간
  heart.stamps.forEach((f, i) => ev(f, 'stamp', { index: i }));
  ev(heart.flies[0], 'fly');
  tl.scenes.heart = heart;

  // ⑤ cta — 로고가 꽝, 말에 맞춰 버튼 → 안심 문구 → 버튼 눌림 → 댓글 안내
  const C = S.cta;
  const cta = {
    ...bounds.cta,
    logoAt: c0,
    colonAt: c0 + 4,
    buttonAt: FV(vAt('cta', C.buttonAt ?? 0.33)),
    noteAt: FV(vAt('cta', C.noteAt ?? 0.53)),
    pressAt: FV(vAt('cta', C.pressAt ?? 1.2)),
    guideAt: FV(vAt('cta', C.guideAt ?? 1.2)),
  };
  const ctaRest = Math.min(total - 1, Math.max(cta.buttonAt, cta.noteAt, cta.pressAt, C.guide ? cta.guideAt : 0) + 14);
  cta.restAt = ctaRest; // 모든 요소가 다 나온 뒤 (스틸·세이프존 검사용)
  item('cta.logo', Object.values(C.logo).join(''), cta.logoAt, total, ctaRest);
  item('cta.button', C.button, cta.buttonAt, total, ctaRest);
  if (C.note) item('cta.note', C.note, cta.noteAt, total, ctaRest);
  if (C.guide) item('cta.guide', C.guide.text, cta.guideAt, total, ctaRest);
  ev(c0, 'final');
  ev(cta.colonAt, 'chime');
  ev(cta.pressAt, 'tap', { t: vAt('cta', C.pressAt ?? 1.2) });
  shake(c0, 10, 6);
  tl.scenes.cta = cta;

  // 음악 구간 (초) — 장면 시작 시간을 따라간다
  const sec = (f) => f / fps;
  tl.music = {
    stop: sec(punch.start), // 스톱타임 (단어 타격)
    build: sec(cause.start), // 빌드업
    drop: sec(answer.start), // 드롭
    breakdown: sec(heart.start), // 브레이크다운 (감정)
    final: sec(cta.start), // CTA 드롭
    end: total / fps,
  };
  tl.events.sort((a, b) => a.f - b.f);
  return tl;
}

// 노출 시간·장면 순서·내레이션 배치 검사
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

  // 내레이션: 겹치지 않고, 영상 안에 있고, 자기 장면이 끝나기 전에 끝나야 한다 (자막이 말 도중에 바뀌지 않게)
  const D = cfg.video.duration;
  const voice = tl.voice.map((v) => {
    const sceneEnd = tl.bounds[v.id].end / tl.fps;
    const problems = [];
    if (!(v.to > v.from)) problems.push('녹음 구간(from~to)이 비었습니다');
    if (v.at < 0 || v.end > D + 1e-6) problems.push(`영상 밖(0~${D}초)으로 나갑니다`);
    if (v.end > sceneEnd + 0.05) problems.push(`장면이 끝난 뒤(${sceneEnd.toFixed(2)}초)에도 말이 이어집니다`);
    return { ...v, sceneEnd, problems };
  });
  [...voice].sort((a, b) => a.at - b.at).forEach((v, i, all) => {
    const prev = all[i - 1];
    if (prev && v.at < prev.end) v.problems.push(`앞 문장(${prev.id})과 ${(prev.end - v.at).toFixed(2)}초 겹칩니다`);
  });
  voice.forEach((v) => v.problems.forEach((p) => errors.push(`내레이션 ${v.id}: ${p}`)));
  return { rows, voice, errors, ok: errors.length === 0 };
}
