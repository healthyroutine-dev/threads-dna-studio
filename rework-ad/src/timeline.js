// config(초 단위) → 프레임 단위 타임라인.
// 영상(브라우저)과 오디오·검사(Node)가 같은 계산을 쓰도록 DOM 없이 작성합니다.

// {밑줄} 표기를 뺀 순수 문장
export const plainText = (str) => str.replace(/[{}]/g, '');

const SCENE_ORDER = ['hook', 'punch', 'cause', 'answer', 'show', 'heart', 'push', 'cta'];

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

  // items: 읽어야 하는 문장 (노출 시간·세이프존 검사용)
  // events: 소리 신호, shakes: 화면 흔들림
  const tl = { fps, total, bounds, scenes: {}, items: [], events: [], shakes: [] };
  const item = (id, text, appear, disappear, restAt) => tl.items.push({ id, text, appear, disappear, restAt });
  const ev = (f, type, extra = {}) => tl.events.push({ f, type, ...extra });
  const shake = (f, amp, dur) => tl.shakes.push({ f, amp, dur });
  const wordsOf = (lines) => lines.join(' ').split(/\s+/).filter(Boolean);

  // ① hook — 결제 알림이 쏟아진다 (textAt 이 음수면 첫 프레임에 이미 문장이 떠 있다)
  const hook = { ...bounds.hook, textAt: F(S.hook.textAt), lineGap: F(S.hook.lineGap ?? 0) };
  hook.pays = S.hook.payments.map((p) => ({ ...p, f: F(p.at) }));
  const hookShown = Math.max(hook.start, hook.textAt);
  item('hook.text', S.hook.text.join(' '), hookShown, hook.end, Math.min(hook.end - 2, hookShown + hook.lineGap + 12));
  ev(hook.start, 'impact');
  hook.pays.filter((p) => p.f >= hook.start).forEach((p) => ev(p.f, 'pay'));
  tl.scenes.hook = hook;

  // ① punch — 음악이 멈추고 한 단어씩 쾅
  const punch = { ...bounds.punch };
  punch.words = wordsOf(S.punch.text).map((_, i) => F(S.punch.start + i * S.punch.wordEvery));
  item('punch.text', S.punch.text.join(' '), punch.start, punch.end, punch.end - 2);
  punch.words.forEach((f, i, all) => {
    const last = i === all.length - 1;
    ev(f, 'hit', { big: last });
    shake(f, last ? 24 : 11, last ? 9 : 5);
  });
  tl.scenes.punch = punch;

  // ① cause — 휩팬으로 내 계정 → 게시물 0 줌 펀치
  const cause = { ...bounds.cause, textAt: bounds.cause.start + 3, zoomAt: bounds.cause.start + 9 };
  ev(cause.start, 'whip');
  ev(cause.zoomAt, 'thump');
  shake(cause.zoomAt, 7, 5);
  tl.scenes.cause = cause;

  // ② answer — 드롭: 레드 라인이 화면을 가르고(분할) 밑줄로 자리 잡는다
  const a0 = bounds.answer.start;
  const answer = {
    ...bounds.answer,
    lineDraw: [a0, a0 + 5],
    split: [a0 + 5, a0 + 17],
    morph: [a0 + 15, a0 + 28],
    textAt: a0 + 8,
  };
  item('cause.text', S.cause.text.join(' '), cause.textAt, answer.split[0] + 4, a0 - 3);
  item('answer.text', plainText(S.answer.text.join(' ')), answer.textAt, answer.end, answer.end - 3);
  ev(a0, 'drop');
  shake(a0, 14, 7);
  tl.scenes.answer = answer;

  // ③ show — 같은 계정이 정리되며 채워진다
  const show = { ...bounds.show };
  show.caps = S.show.captions.map((c) => ({ ...c, f: F(c.at) }));
  show.caps.forEach((c, i) => {
    const next = show.caps[i + 1]?.f ?? show.end;
    item(`show.cap${i}`, plainText(c.text.join(' ')), c.f + 1, next, next - 3);
  });
  show.tiles = cfg.profile.tiles.map((_, i) => F(S.show.start + 0.1 + i * S.show.tileEvery));
  show.tiles.forEach((f, i) => ev(f, 'tile', { index: i }));
  tl.scenes.show = show;

  // ④ heart — 강의 카드가 쌓이고 하나씩 '수강 완료'
  const n = Math.min(S.heart.cards, S.hook.payments.length);
  const heart = { ...bounds.heart, textAt: bounds.heart.start + 3 };
  heart.lands = Array.from({ length: n }, (_, i) => heart.start - 4 + i * 5); // 컷 직전부터 떨어지기 시작
  heart.stamps = Array.from({ length: n }, (_, i) => F(S.heart.start + 0.5 + i * 0.25));
  item('heart.text', plainText(S.heart.text.join(' ')), heart.textAt, heart.end, heart.end - 3);
  heart.lands.forEach((f) => ev(f + 7, 'land')); // 카드가 닿는 순간
  heart.stamps.forEach((f, i) => ev(f, 'stamp', { index: i }));
  tl.scenes.heart = heart;

  // ④ push — 쌓인 카드가 하나씩 위로 날아간다
  const push = { ...bounds.push, textAt: bounds.push.start + 3 };
  push.flies = Array.from({ length: n }, (_, i) => F(S.push.start + 0.1 + i * 0.25));
  item('push.text', plainText(S.push.text.join(' ')), push.textAt, push.end, push.end - 3);
  push.flies.forEach((f) => ev(f, 'fly'));
  tl.scenes.push = push;

  // ⑤ cta — 로고가 꽝, 버튼, 안심 문구, 주소
  const c0 = bounds.cta.start;
  const cta = { ...bounds.cta, logoAt: c0, colonAt: c0 + 4, buttonAt: c0 + 10, noteAt: c0 + 16, urlAt: c0 + 20, pressAt: F(S.cta.pressAt) };
  item('cta.logo', Object.values(S.cta.logo).join(''), cta.logoAt, total, cta.urlAt + 14);
  item('cta.button', S.cta.button, cta.buttonAt, total, cta.urlAt + 14);
  if (S.cta.note) item('cta.note', S.cta.note, cta.noteAt, total, cta.urlAt + 14);
  item('cta.url', S.cta.url, cta.urlAt, total, cta.urlAt + 14);
  ev(c0, 'final');
  ev(cta.colonAt, 'chime');
  ev(cta.pressAt, 'tap');
  shake(c0, 10, 6);
  tl.scenes.cta = cta;

  // 음악 구간 (초) — 장면 시작 시간을 따라간다
  const sec = (f) => f / fps;
  tl.music = {
    stop: sec(punch.start), // 스톱타임 (단어 타격)
    build: sec(cause.start), // 빌드업
    drop: sec(answer.start), // 드롭
    breakdown: sec(heart.start), // 브레이크다운 (감정)
    build2: sec(push.start), // 두 번째 빌드업
    final: sec(cta.start), // CTA 드롭
    end: total / fps,
  };
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
