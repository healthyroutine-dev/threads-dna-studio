// RE:WORK STUDIO 15s — 장면 구성과 프레임별 렌더링.
// window.renderFrame(f) 는 프레임 번호만으로 화면 전체를 결정합니다 (시간·랜덤에 의존하지 않음).
// 문구·타이밍·컬러는 ../config.js 에서만 바꿉니다.
// 슬라이드처럼 보이지 않도록: 자막 아래 UI 는 계속 움직이고, 카메라는 늘 천천히 이동하며,
// 컷은 박자에 맞춰 휩팬·줌 펀치·분할·흔들림으로 넘어갑니다.

import config from '../config.js';
import { buildTimeline } from './timeline.js';
import { E, prog, clamp, lerp, el, show, escapeHtml, parseMarkup, inkRect, fitFont } from './lib.js';
import { icon } from './icons.js';

const W = config.video.width;
const H = config.video.height;
const MX = 96; // 좌우 레이아웃 여백 → 콘텐츠 x 96~984
const CW = W - MX * 2;
const SPLIT_Y = 960; // 레드 라인이 화면을 가르는 높이
const TL = buildTimeline(config);
const SC = config.scenes;
const PF = config.profile;
const params = new URLSearchParams(location.search);

const rootStyle = document.documentElement.style;
rootStyle.setProperty('--ink', config.colors.ink);
rootStyle.setProperty('--cream', config.colors.cream);
rootStyle.setProperty('--red', config.colors.red);
rootStyle.setProperty('--font', `'${config.font.family}'`);

const stage = document.getElementById('stage');
const world = el('div', 'world', stage); // 화면 흔들림은 world 전체에 적용

// ── 키네틱 텍스트 ───────────────────────────────────────────────────────────
function textBlock(parent, lines, cls, key) {
  const block = el('div', `tb ${cls}`, parent);
  if (key) block.dataset.key = key;
  const words = [];
  const lineEls = lines.map((line, li) => {
    const lineEl = el('div', 'tb-line', block);
    for (const seg of parseMarkup(line)) {
      if (seg.accent === 'underline') {
        const w = el('span', 'w acc-ul', lineEl);
        el('span', 'ul-text', w, seg.text);
        words.push({ el: w, kind: 'underline', bar: el('span', 'ul-bar', w), text: seg.text, line: li });
        continue;
      }
      for (const tok of seg.text.split(/( )/)) {
        if (!tok) continue;
        if (tok === ' ') {
          lineEl.append(' ');
          continue;
        }
        words.push({ el: el('span', 'w', lineEl, tok), kind: 'word', text: tok, line: li });
      }
    }
    return lineEl;
  });
  return { block, lineEls, words, fit: (maxW = CW) => fitFont(block, lineEls, maxW) };
}

// 단어 애니메이션. mode 'slam': 크게 떨어져 박히듯 / 'rise': 줄 마스크 아래에서 올라옴
// at: 단어별 시작 프레임 배열(없으면 stagger 간격), outAt: 퇴장 시작 프레임
function animWords(tb, f, inAt, o = {}) {
  const mode = o.mode ?? 'slam';
  const stagger = o.stagger ?? 2;
  let t = inAt;
  let line = 0;
  tb.words.forEach((w, i) => {
    if (w.line !== line) {
      t += o.lineGap ?? 0;
      line = w.line;
    }
    const start = o.at ? o.at[i] : t;
    t += stagger;
    const kout = o.outAt == null ? 0 : prog(f, o.outAt, o.outDur ?? 4, E.inCubic);
    const on = f >= start && kout < 1;
    if (mode === 'slam') {
      const k = prog(f, start, o.dur ?? 6, E.outCubic);
      const s = lerp(o.from ?? 1.35, 1, k);
      w.el.style.transform = `translateY(${(-kout * 60).toFixed(1)}px) scale(${s.toFixed(4)})`;
      w.el.style.opacity = on ? (Math.min(1, (f - start + 1) / 2) * (1 - kout)).toFixed(3) : '0';
    } else {
      const k = prog(f, start, o.dur ?? 12, E.outExpo);
      w.el.style.transform = `translateY(${((1 - k) * 110 - kout * 110).toFixed(2)}%)`;
      w.el.style.opacity = on ? '1' : '0';
    }
    if (w.kind === 'underline') {
      const u = o.underlineAt ?? start + 8;
      w.bar.style.transform = `scaleX(${o.underlineInstant ? (f >= u ? 1 : 0) : prog(f, u, 10, E.outExpo).toFixed(4)})`;
    }
  });
}

// 결정적 흔들림 (프레임마다 같은 값)
const noise = (f, seed) => {
  const x = Math.sin(f * 12.9898 + seed * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

// ── 공용 UI: 결제 알림 카드 ──────────────────────────────────────────────────
function payCard(parent, pay, theme) {
  const c = el('div', `pay ${theme}`, parent);
  el('div', 'pay-icon', c).innerHTML = icon('card');
  const body = el('div', 'pay-body', c);
  const head = el('div', 'pay-head', body);
  el('span', '', head, SC.hook.payLabel);
  el('span', '', head, '지금');
  const main = el('div', 'pay-main', body);
  el('span', 'pay-item', main, pay.item);
  const price = el('span', 'pay-price', main, pay.price);
  let stamp = null;
  if (theme === 'cream') {
    stamp = el('span', 'stamp', c);
    stamp.innerHTML = `${icon('check')}<span>${escapeHtml(SC.heart.stamp)}</span>`;
  }
  return { el: c, price, stamp };
}

// ── 공용 UI: 계정(프로필) 화면. empty=true 면 게시물 0, 아니면 정리된 계정 ─────────────
function profileUI(parent, theme, empty) {
  const pf = el('div', `pf ${theme}`, parent);
  const top = el('div', 'pf-top', pf);
  top.innerHTML = `<span class="pf-handle">${escapeHtml(PF.handle)}${icon('chevron')}</span>${icon('menu')}`;
  const head = el('div', 'pf-head', pf);
  const avatar = el('div', 'pf-avatar', head);
  avatar.innerHTML = empty ? icon('plus') : '<i></i>';
  const stats = el('div', 'pf-stats', head);
  const stat = (value, label) => {
    const s = el('div', 'pf-stat', stats);
    const b = el('b', '', s, value);
    el('span', '', s, label);
    return { s, b };
  };
  const posts = stat('0', '게시물');
  const others = [stat(PF.followers, '팔로워'), stat(PF.following, '팔로잉')];
  const bio = el('div', 'pf-bio', pf);
  const bioLines = empty
    ? [el('div', 'bar', bio), el('div', 'bar short', bio)]
    : PF.bio.map((line, i) => el('div', `line${i === 0 ? ' strong' : ''}`, bio, line));
  const hl = el('div', 'pf-hl', pf);
  const hlItems = (empty ? ['+'] : PF.highlights).map((label) => {
    const item = el('div', 'pf-hl-item', hl);
    el('i', '', item);
    el('span', '', item, empty ? '새로 만들기' : label);
    return item;
  });
  let tiles = [];
  let emptyBox = null;
  if (empty) {
    emptyBox = el('div', 'pf-empty', pf);
    emptyBox.innerHTML = `${icon('camera')}<span>${escapeHtml(PF.empty)}</span>`;
  } else {
    const grid = el('div', 'pf-grid', pf);
    tiles = PF.tiles.map((t) => {
      const tile = el('div', `tile ${t.tone}`, grid);
      el('div', 'mark', tile).innerHTML = t.icon ? icon(t.icon) : escapeHtml(t.mark);
      el('div', 'label', tile, t.label);
      return tile;
    });
  }
  return { pf, posts, others, avatar, bioLines, hlItems, tiles, emptyBox };
}

// ── ① hook: 결제 알림이 쏟아진다 (정곡 장면 동안엔 흐릿한 배경으로 남는다) ───────────────
function hookScene() {
  const T = TL.scenes.hook;
  const P = TL.scenes.punch;
  const C = TL.scenes.cause;
  const root = el('div', 'scene dark hook', world);
  const inner = el('div', 'inner', root);
  const stack = el('div', 'pay-stack', inner);
  const cards = T.pays.map((p) => payCard(stack, p, 'dark'));
  el('div', 'scrim dark', inner);
  const cap = textBlock(inner, SC.hook.text, 'cap hook-cap on-dark free', 'hook.text');
  const SLOT = 136; // 카드 124 + 간격 12
  const VISIBLE = 5;
  const ARRIVE = 6; // 도착 애니메이션 길이 (at 시점에 도착 완료)
  const arrive = (i) => T.pays[i].f - ARRIVE;

  return {
    fit: () => cap.fit(),
    update(f) {
      const on = f >= T.start && f < C.start;
      show(root, on);
      if (!on) return;
      const ghost = f >= P.start ? 1 : 0; // 음악이 멈추는 순간 배경도 멈춘 듯 흐려진다
      inner.style.transform = `scale(${(1 + 0.06 * prog(f, T.start, C.start - T.start)).toFixed(4)})`;
      stack.style.opacity = (1 - 0.8 * ghost).toFixed(3);
      stack.style.filter = ghost > 0 ? `blur(${(7 * ghost).toFixed(1)}px)` : 'none';
      const drift = Math.max(0, f - P.start) * 3; // 멈춘 뒤에도 천천히 흘러내림
      cards.forEach((c, i) => {
        if (f < arrive(i)) {
          c.el.style.opacity = '0';
          return;
        }
        const pin = prog(f, arrive(i), ARRIVE, E.outCubic);
        let k = 0;
        for (let j = i + 1; j < cards.length; j++) k += prog(f, arrive(j), ARRIVE, E.outCubic);
        const depth = Math.max(0, k - (VISIBLE - 1));
        const y = Math.min(k, VISIBLE - 1) * SLOT + depth * 20 - (1 - pin) * 90 + drift;
        const s = lerp(0.88, 1, pin) * (1 - depth * 0.05);
        c.el.style.transform = `translateY(${y.toFixed(2)}px) scale(${s.toFixed(4)})`;
        c.el.style.opacity = (pin * clamp(1 - depth * 0.6)).toFixed(3);
        c.el.style.zIndex = String(10 + i);
      });
      show(cap.block, f < P.start);
      animWords(cap, f, T.textAt, { mode: 'slam', stagger: 2, lineGap: T.lineGap, from: 1.3 });
    },
  };
}

// ── ① punch: 음악이 멈추고 거대한 글자가 한 단어씩 떨어진다 ──────────────────────────
function punchScene() {
  const T = TL.scenes.punch;
  const root = el('div', 'scene punch', world);
  const tb = textBlock(root, SC.punch.text, 'giant free', 'punch.text');
  const WHIP = 6;
  return {
    fit: () => tb.fit(),
    update(f) {
      const on = f >= T.start && f < T.end + WHIP;
      show(root, on);
      if (!on) return;
      const last = T.words[T.words.length - 1];
      animWords(tb, f, T.start, { mode: 'slam', at: T.words, from: 1.6, dur: 5 });
      tb.block.style.transform = `scale(${(1 + 0.05 * prog(f, last, T.end - last, E.outCubic)).toFixed(4)})`;
      const kw = prog(f, T.end, WHIP, E.inCubic); // 휩팬으로 왼쪽으로 빠진다
      root.style.transform = `translateX(${(-kw * 1150).toFixed(1)}px)`;
      root.style.filter = kw > 0 ? `blur(${(kw * 16).toFixed(1)}px)` : 'none';
    },
  };
}

// ── ① cause: 휩팬으로 내 계정 → '게시물 0' 줌 펀치. 레드 라인에 위/아래로 갈라지도록 두 벌 ──
function causeScene(half) {
  const T = TL.scenes.cause;
  const A = TL.scenes.answer;
  const isTop = half === 'top';
  const root = el('div', 'scene dark cause', world);
  const cam = el('div', 'inner', root);
  const prof = profileUI(cam, 'dark', true);
  el('div', 'scrim dark low', root);
  const cap = textBlock(root, SC.cause.text, 'cap on-dark free', 'cause.text');
  let focus = { x: 540, y: 500 };
  const ZOOM_TO = { x: 430, y: 700 }; // 줌 후 '0' 이 놓일 위치
  const WHIP = 6;
  return {
    fit() {
      cap.fit();
      const r = prof.posts.b.getBoundingClientRect();
      focus = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    update(f) {
      const on = f >= T.start && f <= A.split[1] && (isTop || f >= A.split[0]);
      show(root, on);
      if (!on) return;
      // '게시물 0' 이 화면 가운데로 크게 당겨진다
      const kz = prog(f, T.zoomAt, 7, E.outExpo);
      const drift = prog(f, T.zoomAt + 7, A.start - T.zoomAt - 7);
      const dx = (ZOOM_TO.x - focus.x) * kz;
      const dy = (ZOOM_TO.y - focus.y) * kz;
      cam.style.transformOrigin = `${focus.x.toFixed(1)}px ${focus.y.toFixed(1)}px`;
      cam.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${(1 + 1.2 * kz + 0.1 * drift).toFixed(4)})`;
      const dim = (1 - 0.65 * kz).toFixed(3); // 0 만 남기고 나머지는 흐리게
      prof.others.forEach((o) => (o.s.style.opacity = dim));
      prof.emptyBox.style.opacity = (1 - kz).toFixed(3);
      animWords(cap, f, T.textAt, { mode: 'slam', stagger: 2, lineGap: 5 });
      if (f >= A.split[0]) {
        const k = prog(f, A.split[0], A.split[1] - A.split[0], E.inOutCubic);
        root.style.clipPath = isTop ? `inset(0 0 ${H - SPLIT_Y}px 0)` : `inset(${SPLIT_Y}px 0 0 0)`;
        root.style.transform = `translateY(${((isTop ? -1 : 1) * k * H * 0.56).toFixed(2)}px)`;
        root.style.filter = 'none';
      } else {
        const kw = prog(f, T.start, WHIP, E.outCubic); // 오른쪽에서 휩팬으로 들어온다
        root.style.clipPath = 'none';
        root.style.transform = `translateX(${((1 - kw) * 1150).toFixed(1)}px)`;
        root.style.filter = kw < 1 ? `blur(${((1 - kw) * 16).toFixed(1)}px)` : 'none';
      }
    },
  };
}

// ── 전환: 크림 배경, 레드 라인(가르기 → 밑줄), 상단 브랜드 바 ──────────────────────
function creamLayer() {
  const A = TL.scenes.answer;
  const node = el('div', 'cream-bg', world);
  return { update: (f) => show(node, f >= A.split[0]) };
}

function redLineLayer(answer) {
  const A = TL.scenes.answer;
  const node = el('div', 'redline', world);
  const from = { x: 0, y: SPLIT_Y - 4, w: W, h: 8 };
  let to = from;
  return {
    fit() {
      const bar = answer.underline;
      if (!bar) return;
      const prev = bar.style.transform;
      bar.style.transform = 'none';
      const r = bar.getBoundingClientRect();
      bar.style.transform = prev;
      to = { x: r.left, y: r.top, w: r.width, h: r.height };
    },
    update(f) {
      const on = f >= A.lineDraw[0] && f < A.morph[1];
      show(node, on);
      if (!on) return;
      const m = prog(f, A.morph[0], A.morph[1] - A.morph[0], E.inOutCubic);
      node.style.left = `${lerp(from.x, to.x, m).toFixed(2)}px`;
      node.style.top = `${lerp(from.y, to.y, m).toFixed(2)}px`;
      node.style.width = `${lerp(from.w, to.w, m).toFixed(2)}px`;
      node.style.height = `${lerp(from.h, to.h, m).toFixed(2)}px`;
      node.style.transform = `scaleX(${prog(f, A.lineDraw[0], A.lineDraw[1] - A.lineDraw[0], E.outExpo).toFixed(4)})`;
    },
  };
}

// 4초 드롭 이후 상단에 계속: ● RE:WORK STUDIO  ·  [무료 상담 →]  (5초 안에 브랜드·제안 노출)
function brandBar() {
  const A = TL.scenes.answer;
  const C = TL.scenes.cta;
  const node = el('div', 'brand-bar', world);
  node.innerHTML =
    `<span class="brand-name"><i class="dot"></i>${escapeHtml(config.brand.marker)}</span>` +
    `<span class="brand-pill">${escapeHtml(config.brand.pill)}${icon('arrow')}</span>`;
  const at = A.morph[0];
  return {
    update(f) {
      const on = f >= at && f < C.start;
      show(node, on);
      if (!on) return;
      const k = prog(f, at, 10, E.outCubic);
      node.style.opacity = k.toFixed(3);
      node.style.transform = `translateY(${((1 - k) * -24).toFixed(2)}px)`;
    },
  };
}

// ── ② answer: 배운 걸, 문의 오는 SNS로 ─────────────────────────────────────────
function answerScene() {
  const T = TL.scenes.answer;
  const S = TL.scenes.show;
  const root = el('div', 'scene cream answer', world);
  const tb = textBlock(root, SC.answer.text, 'answer-text free', 'answer.text');
  const ul = tb.words.find((w) => w.kind === 'underline');
  const OUT = 5;
  return {
    underline: ul ? ul.bar : null,
    fit: () => tb.fit(),
    update(f) {
      const on = f >= T.split[0] && f < S.start;
      show(root, on);
      if (!on) return;
      // 밑줄은 레드 라인이 도착하는 순간 그대로 넘겨받는다
      animWords(tb, f, T.textAt, { mode: 'slam', stagger: 2, lineGap: 3, underlineAt: T.morph[1], underlineInstant: true });
      const drift = prog(f, T.textAt, T.end - T.textAt);
      const ko = prog(f, S.start - OUT, OUT, E.inCubic); // 다음 장면 전에 위로 빠진다
      tb.block.style.transform = `translateY(${(-ko * 420).toFixed(1)}px) scale(${(1 + 0.03 * drift - 0.2 * ko).toFixed(4)})`;
      tb.block.style.opacity = (1 - ko).toFixed(3);
    },
  };
}

// ── ③ show: 같은 계정이 정리되며 채워진다 ────────────────────────────────────────
function showScene() {
  const T = TL.scenes.show;
  const root = el('div', 'scene cream show', world);
  const cam = el('div', 'inner', root);
  const prof = profileUI(cam, 'cream', false);
  el('div', 'scrim cream low', root);
  const caps = T.caps.map((c, i) => textBlock(root, c.text, 'cap on-cream free', `show.cap${i}`));
  return {
    fit: () => caps.forEach((c) => c.fit()),
    update(f) {
      const on = f >= T.start && f < T.end;
      show(root, on);
      if (!on) return;
      const kin = prog(f, T.start, 12, E.outExpo); // 아래에서 올라오며 등장
      const pull = prog(f, T.start, T.end - T.start, E.outCubic); // 천천히 줌 아웃
      cam.style.transform = `translateY(${((1 - kin) * 900).toFixed(1)}px) scale(${lerp(1.06, 1.0, pull).toFixed(4)})`;
      prof.bioLines.forEach((b, i) => {
        const k = prog(f, T.start + 4 + i * 3, 10, E.outExpo);
        b.style.transform = `translateX(${((1 - k) * -40).toFixed(1)}px)`;
        b.style.opacity = k.toFixed(3);
      });
      prof.hlItems.forEach((h, i) => {
        const k = prog(f, T.start + 6 + i * 2, 9, E.outBack);
        h.style.transform = `scale(${lerp(0.3, 1, k).toFixed(4)})`;
        h.style.opacity = f >= T.start + 6 + i * 2 ? '1' : '0';
      });
      const kr = prog(f, T.start + 2, 10, E.outBack);
      prof.avatar.style.transform = `scale(${lerp(0.6, 1, kr).toFixed(4)})`;
      let count = 0;
      prof.tiles.forEach((tile, i) => {
        const a = T.tiles[i];
        if (f >= a) count++;
        const k = prog(f, a, 9, E.outBack);
        tile.style.transform = `scale(${lerp(0.35, 1, k).toFixed(4)})`;
        tile.style.opacity = f >= a ? '1' : '0';
      });
      prof.posts.b.textContent = String(count);
      caps.forEach((c, i) => {
        const a = T.caps[i].f;
        const next = T.caps[i + 1]?.f;
        show(c.block, f >= a && (next == null || f < next + 4));
        animWords(c, f, a + 1, { mode: 'slam', stagger: 2, lineGap: 4, outAt: next ?? null });
      });
    },
  };
}

// ── ④ heart + push: 강의 카드가 쌓여 '수강 완료' → 하나씩 위로 날아간다 ─────────────────
function learnScene() {
  const Hh = TL.scenes.heart;
  const Pu = TL.scenes.push;
  const root = el('div', 'scene cream learn', world);
  const cam = el('div', 'inner', root);
  const pile = el('div', 'pile', cam);
  const cards = Hh.lands.map((_, i) => payCard(pile, SC.hook.payments[i], 'cream'));
  const heartCap = textBlock(root, SC.heart.text, 'cap learn-cap on-cream', 'heart.text');
  const pushCap = textBlock(root, SC.push.text, 'cap learn-cap on-cream', 'push.text');
  const SLOT = 134;
  const tilt = [-7, 5, -4, 6, -5];
  return {
    fit() {
      heartCap.fit();
      pushCap.fit();
    },
    update(f) {
      const on = f >= Hh.start && f < Pu.end;
      show(root, on);
      if (!on) return;
      cam.style.transform = `scale(${(1 + 0.05 * prog(f, Hh.start, Pu.end - Hh.start)).toFixed(4)})`;
      cards.forEach((c, i) => {
        const land = prog(f, Hh.lands[i], 9, E.outBack);
        const fly = prog(f, Pu.flies[i], 10, E.inQuad);
        const y = i * SLOT + (1 - land) * -900 - fly * 1900;
        const r = tilt[i % tilt.length] * (1 - land) + fly * (i % 2 ? 9 : -9);
        c.el.style.transform = `translateY(${y.toFixed(1)}px) rotate(${r.toFixed(2)}deg)`;
        c.el.style.opacity = f >= Hh.lands[i] && fly < 1 ? '1' : '0';
        c.el.style.filter = fly > 0.05 ? `blur(${(fly * 10).toFixed(1)}px)` : 'none';
        const ks = prog(f, Hh.stamps[i], 6, E.outCubic);
        c.stamp.style.opacity = f >= Hh.stamps[i] ? '1' : '0';
        c.stamp.style.transform = `translateY(-50%) rotate(-8deg) scale(${lerp(2.2, 1, ks).toFixed(4)})`;
        c.price.style.opacity = f >= Hh.stamps[i] ? '0.25' : '1';
      });
      show(heartCap.block, f < Pu.start);
      animWords(heartCap, f, Hh.textAt, { mode: 'rise', stagger: 3, lineGap: 4, dur: 14 });
      show(pushCap.block, f >= Pu.start);
      animWords(pushCap, f, Pu.textAt, { mode: 'rise', stagger: 2, lineGap: 3, dur: 12, underlineAt: Pu.textAt + 18 });
    },
  };
}

// ── ⑤ CTA: 로고가 꽝 → 무료 상담 버튼 → 안심 문구 → 주소 ─────────────────────────────
function ctaScene() {
  const T = TL.scenes.cta;
  const S = SC.cta;
  const root = el('div', 'scene cream cta', world);
  const logo = el('div', 'logo', root);
  logo.dataset.key = 'cta.logo';
  el('span', 'lg-part', logo, S.logo.left);
  const colon = el('span', 'lg-colon', logo);
  el('span', '', colon, S.logo.colon);
  el('span', 'lg-part', logo, S.logo.right);
  el('span', 'lg-part lg-suffix', logo, S.logo.suffix);

  const btn = el('div', 'cta-btn', root);
  btn.dataset.key = 'cta.button';
  el('span', 'btn-text', btn, S.button);
  btn.insertAdjacentHTML('beforeend', icon('arrow'));
  const ripple = el('span', 'ripple', btn);
  const note = S.note ? el('div', 'cta-note', root, S.note) : null;
  if (note) note.dataset.key = 'cta.note';
  const url = el('div', 'cta-url', root);
  url.dataset.key = 'cta.url';
  url.innerHTML = `${icon('lock')}<span>${escapeHtml(S.url)}</span>`;

  const fitBox = (node, maxW) => {
    const w = node.getBoundingClientRect().width;
    if (w > maxW) node.style.fontSize = `${Math.floor(parseFloat(getComputedStyle(node).fontSize) * (maxW / w))}px`;
  };
  return {
    fit() {
      const w = [...logo.children].reduce((a, c) => a + c.getBoundingClientRect().width, 0);
      if (w > CW) logo.style.fontSize = `${Math.floor(parseFloat(getComputedStyle(logo).fontSize) * (CW / w))}px`;
      fitBox(btn, CW);
      fitBox(url, CW);
    },
    update(f) {
      const on = f >= T.start;
      show(root, on);
      if (!on) return;
      const kl = prog(f, T.logoAt, 8, E.outBack);
      logo.style.transform = `scale(${lerp(1.45, 1, kl).toFixed(4)})`;
      logo.style.opacity = Math.min(1, (f - T.logoAt + 1) / 2).toFixed(3);
      const kc = prog(f, T.colonAt, 10, E.outBack);
      colon.style.transform = `scale(${kc.toFixed(4)}) rotate(${((1 - kc) * -30).toFixed(1)}deg)`;
      colon.style.opacity = f >= T.colonAt ? '1' : '0';

      const kb = prog(f, T.buttonAt, 12, E.outExpo);
      const press = f >= T.pressAt ? Math.sin(Math.PI * prog(f, T.pressAt, 8)) : 0;
      btn.style.transform = `translate(-50%, ${((1 - kb) * 80).toFixed(2)}px) scale(${(1 - 0.05 * press).toFixed(4)})`;
      btn.style.opacity = prog(f, T.buttonAt, 3).toFixed(3);
      const kr = prog(f, T.pressAt, 16, E.outCubic);
      ripple.style.transform = `scale(${(kr * 24).toFixed(3)})`;
      ripple.style.opacity = f >= T.pressAt ? (0.26 * (1 - kr)).toFixed(3) : '0';
      if (note) {
        const kn = prog(f, T.noteAt, 12, E.outExpo);
        note.style.transform = `translateY(${((1 - kn) * 30).toFixed(2)}px)`;
        note.style.opacity = prog(f, T.noteAt, 5).toFixed(3);
      }
      const ku = prog(f, T.urlAt, 12, E.outExpo);
      url.style.transform = `translate(-50%, ${((1 - ku) * 40).toFixed(2)}px)`;
      url.style.opacity = prog(f, T.urlAt, 4).toFixed(3);
    },
  };
}

// ── 조립 ──────────────────────────────────────────────────────────────────
const layers = [];

function build() {
  layers.push(hookScene(), punchScene());
  layers.push(creamLayer());
  layers.push(causeScene('top'), causeScene('bottom'));
  const answer = answerScene();
  layers.push(answer, showScene(), learnScene(), ctaScene(), brandBar(), redLineLayer(answer));
  layers.forEach((l) => l.fit && l.fit()); // 모든 요소가 기본 위치에 있을 때 크기·위치 측정
}

function shakeWorld(f) {
  let x = 0;
  let y = 0;
  for (const s of TL.shakes) {
    const d = f - s.f;
    if (d < 0 || d >= s.dur) continue;
    const a = s.amp * (1 - d / s.dur);
    x += noise(f, 1 + s.f) * a;
    y += noise(f, 7 + s.f) * a;
  }
  world.style.transform = x || y ? `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)` : 'none';
}

function debugOverlay() {
  const R = config.rules;
  const top = el('div', 'safe', stage);
  top.style.top = '0';
  top.style.height = `${R.safeTop}px`;
  const bottom = el('div', 'safe', stage);
  bottom.style.bottom = '0';
  bottom.style.height = `${R.safeBottom}px`;
  for (const x of [R.safeSide, W - R.safeSide]) el('div', 'safe-side', stage).style.left = `${x}px`;
}

window.renderFrame = (f) => {
  for (const l of layers) l.update(f);
  shakeWorld(f);
};

// 핵심 문장이 인스타 UI 영역·좌우 여백을 침범하는지 검사 (render.mjs 가 호출)
const unionRect = (nodes) =>
  nodes.map((n) => n.getBoundingClientRect()).reduce((a, r) => ({
    left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom),
  }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });

window.__checkSafe = () => {
  const R = config.rules;
  const box = { left: R.safeSide, right: W - R.safeSide, top: R.safeTop, bottom: H - R.safeBottom };
  return TL.items.map((it) => {
    window.renderFrame(it.restAt);
    let r = null;
    for (const n of stage.querySelectorAll(`[data-key="${it.id}"]`)) {
      if (!n.getClientRects().length) continue;
      const textOnly = ['tb', 'cta-note'].some((c) => n.classList.contains(c));
      const b = textOnly ? inkRect(n) : n.classList.contains('logo') ? unionRect([...n.children]) : n.getBoundingClientRect();
      if (!b) continue;
      r = r
        ? { left: Math.min(r.left, b.left), top: Math.min(r.top, b.top), right: Math.max(r.right, b.right), bottom: Math.max(r.bottom, b.bottom) }
        : { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
    }
    const ok = !!r && r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom;
    return { id: it.id, text: it.text, frame: it.restAt, rect: r && Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v)])), ok };
  });
};

window.__timeline = TL;

(async () => {
  await document.fonts.load(`800 100px "${config.font.family}"`, '가A');
  await document.fonts.ready;
  build();
  if (params.has('debug')) debugOverlay();
  const start = Number(params.get('frame') || 0);
  window.renderFrame(start);
  window.__ready = true;
})();
