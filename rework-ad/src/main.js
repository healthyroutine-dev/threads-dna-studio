// RE:WORK STUDIO 15s — 장면 구성과 프레임별 렌더링.
// window.renderFrame(f) 는 프레임 번호만으로 화면 전체를 결정합니다 (시간·랜덤에 의존하지 않음).
// 문구·타이밍·컬러는 ../config.js 에서만 바꿉니다.

import config from '../config.js';
import { buildTimeline } from './timeline.js';
import { E, prog, clamp, lerp, el, show, escapeHtml, parseMarkup, inkRect, fitFont } from './lib.js';
import { icon } from './icons.js';

const W = config.video.width;
const H = config.video.height;
const MX = 96; // 좌우 레이아웃 여백 → 콘텐츠 x 96~984
const CW = W - MX * 2;
const SPLIT_Y = 960; // 레드 라인이 화면을 가르는 높이
const RULE_Y = 768; // 전환 후 레드 라인이 자리 잡는 구분선 높이 (헤드라인 아래)
const TL = buildTimeline(config);
const SC = config.scenes;
const params = new URLSearchParams(location.search);

const rootStyle = document.documentElement.style;
rootStyle.setProperty('--ink', config.colors.ink);
rootStyle.setProperty('--cream', config.colors.cream);
rootStyle.setProperty('--red', config.colors.red);
rootStyle.setProperty('--font', `'${config.font.family}'`);

const stage = document.getElementById('stage');

// ── 키네틱 텍스트 ───────────────────────────────────────────────────────────
function textBlock(parent, lines, cls, key) {
  const block = el('div', `tb ${cls}`, parent);
  if (key) block.dataset.key = key;
  const words = [];
  const lineEls = lines.map((line, li) => {
    const lineEl = el('div', 'tb-line', block);
    for (const seg of parseMarkup(line)) {
      if (seg.accent === 'bracket') {
        const w = el('span', 'w acc-br', lineEl);
        const open = el('span', 'br', w, '[');
        const core = el('span', 'core', w, seg.text);
        const close = el('span', 'br', w, ']');
        words.push({ el: w, kind: 'bracket', open, core, close, text: seg.text, line: li });
        continue;
      }
      if (seg.accent === 'underline') {
        const w = el('span', 'w acc-ul', lineEl);
        el('span', 'ul-text', w, seg.text);
        words.push({ el: w, kind: 'underline', bar: el('span', 'ul-bar', w), text: seg.text, line: li });
        continue;
      }
      for (const tok of seg.text.split(/( |…)/)) {
        if (!tok) continue;
        if (tok === ' ') {
          lineEl.append(' ');
          continue;
        }
        const kind = tok === '…' ? 'ellipsis' : 'word';
        words.push({ el: el('span', `w ${kind}`, lineEl, tok), kind, text: tok, line: li });
      }
    }
    return lineEl;
  });
  return { block, lineEls, words, fit: (maxW = CW) => fitFont(block, lineEls, maxW) };
}

// 단어가 줄 마스크 아래에서 차례로 올라오고(inAt~), 위로 빠져나간다(outAt~).
function kinetic(tb, f, inAt, outAt, o = {}) {
  const stagger = o.stagger ?? 2;
  const dur = o.dur ?? 12;
  const outDur = o.outDur ?? 7;
  const outStagger = o.outStagger ?? 1;
  const dotGap = o.dotGap ?? 3;
  let t = inAt;
  let line = 0;
  tb.words.forEach((w, i) => {
    if (w.line !== line) {
      t += o.lineGap ?? 0; // 다음 줄은 조금 늦게 (앞 줄을 먼저 읽도록)
      line = w.line;
    }
    if (w.kind === 'ellipsis') t += o.ellipsisLead ?? 0;
    const start = t;
    t += stagger + (w.kind === 'ellipsis' ? (o.ellipsisPause ?? 0) + 2 * dotGap : 0);
    const kout = outAt == null ? 0 : prog(f, outAt + i * outStagger, outDur, E.inCubic);
    let kin = prog(f, start, dur, E.outExpo);
    const visible = f >= start && kout < 1;

    if (w.kind === 'ellipsis') {
      // 말줄임표는 점이 하나씩 찍힌다
      const dots = f < start ? 0 : Math.min(3, 1 + Math.floor((f - start) / dotGap));
      w.el.style.clipPath = `inset(-0.4em ${(((3 - dots) / 3) * 100).toFixed(1)}% -0.4em 0)`;
      kin = 1;
    }
    w.el.style.transform = `translateY(${((1 - kin) * 110 - kout * 110).toFixed(2)}%)`;
    w.el.style.opacity = visible ? '1' : '0';

    if (w.kind === 'bracket') {
      const at = start + 5;
      const kb = prog(f, at, 10, E.outBack);
      const a = f >= at ? String(Math.min(1, (f - at + 1) / 3)) : '0';
      w.open.style.transform = `translateX(${((1 - kb) * 0.45).toFixed(3)}em)`;
      w.close.style.transform = `translateX(${(-(1 - kb) * 0.45).toFixed(3)}em)`;
      w.open.style.opacity = a;
      w.close.style.opacity = a;
    }
    if (w.kind === 'underline') {
      const at = o.underlineAt ?? start + 10;
      w.bar.style.transform = `scaleX(${prog(f, at, 12, E.outExpo).toFixed(4)})`;
    }
  });
}

// ── ① hook: 바쁜 하루 — 시계가 흐르고 알림이 쌓인다 ─────────────────────────
function hookScene() {
  const T = TL.scenes.hook;
  const S = SC.hook;
  const root = el('div', 'scene dark hook', stage);
  const inner = el('div', 'inner', root);
  const clock = el('div', 'clock', inner);
  el('div', 'clock-label', clock, S.clock.label);
  const time = el('div', 'clock-time', clock, S.clock.from);
  const stack = el('div', 'notif-stack', inner);
  const cards = T.notifs.map((n) => {
    const c = el('div', `notif${n.highlight ? ' hl' : ''}`, stack);
    el('div', 'notif-icon', c).innerHTML = icon(n.icon);
    const body = el('div', 'notif-body', c);
    const head = el('div', 'notif-head', body);
    el('span', '', head, n.app);
    el('span', '', head, '지금');
    el('div', 'notif-title', body, n.title);
    return c;
  });
  const text = textBlock(inner, S.text, 'hook-text', 'hook.text');
  const toMin = (s) => s.split(':').reduce((acc, v) => acc * 60 + Number(v), 0);
  const m0 = toMin(S.clock.from);
  const m1 = toMin(S.clock.to);
  const pad = (n) => String(n).padStart(2, '0');
  const SLOT = 142; // 카드 높이 128 + 간격 14
  const VISIBLE = 4; // 완전히 보이는 카드 수 (나머지는 뒤로 겹쳐 사라짐)
  const ARRIVE = 8; // 알림이 내려와 자리 잡는 프레임 수 (config 의 at 시점에 도착 완료)
  const arrive = (i) => T.notifs[i].f - ARRIVE;

  return {
    fit: () => text.fit(),
    update(f) {
      const on = f >= T.start && f < T.end;
      show(root, on);
      if (!on) return;
      inner.style.transform = `scale(${(1 + 0.03 * prog(f, T.start, T.end - T.start)).toFixed(4)})`;
      const mins = Math.round(lerp(m0, m1, prog(f, T.start, T.end - T.start - 4, E.inOutSine)));
      time.textContent = `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;
      cards.forEach((c, i) => {
        if (f < arrive(i)) {
          c.style.opacity = '0';
          return;
        }
        const pin = prog(f, arrive(i), ARRIVE, E.outCubic);
        let k = 0;
        for (let j = i + 1; j < cards.length; j++) k += prog(f, arrive(j), ARRIVE, E.outCubic);
        const depth = Math.max(0, k - (VISIBLE - 1));
        const y = Math.min(k, VISIBLE - 1) * SLOT + depth * 22 - (1 - pin) * 80;
        const s = lerp(0.9, 1, pin) * (1 - depth * 0.05);
        c.style.transform = `translateY(${y.toFixed(2)}px) scale(${s.toFixed(4)})`;
        c.style.opacity = (pin * clamp(1 - depth * 0.6)).toFixed(3);
        c.style.zIndex = String(10 + i);
      });
      kinetic(text, f, T.textAt, null, { stagger: 2, dur: 12, ellipsisLead: 2, dotGap: 3, lineGap: T.lineGap });
    },
  };
}

// ── ② struggle: 게시물 문구를 쓰다 지우는 입력창 ─────────────────────────────
function caretAlpha(st, f) {
  const d = f - (st.blinkFrom ?? st.f);
  switch (st.phase) {
    case 'typing':
    case 'erasing':
      return 1;
    case 'selected':
      return 0;
    case 'empty':
      return d < 3 ? 1 : clamp(1 - (d - 3) / 2); // 빈 칸에 잠깐 남았다가 사라지는 커서
    default:
      return Math.floor(d / 8) % 2 === 0 ? 1 : 0; // 깜빡임 (8프레임 켜짐 / 8프레임 꺼짐)
  }
}

function composerScene(idx) {
  const cut = TL.scenes.struggle.cuts[idx];
  const S = SC.struggle.composer;
  const zoom = cut.zoom || 1;
  const root = el('div', 'scene dark composer', stage);
  const inner = el('div', 'inner', root);
  el('div', 'cmp-bar', inner).innerHTML =
    `<span class="cmp-x">${icon('close')}</span>` +
    `<span class="cmp-title">${escapeHtml(S.title)}</span>` +
    `<span class="cmp-action">${escapeHtml(S.action)}</span>`;
  el('div', 'cmp-sep', inner);
  el('div', 'cmp-media', inner).innerHTML = `${icon('plus')}<span>${escapeHtml(S.media)}</span>`;
  const field = el('div', 'cmp-field', inner);
  el('div', 'cmp-label', field, S.label);
  const text = el('div', 'cmp-text', field);
  text.dataset.key = `struggle.cut${idx}`;
  el('div', 'cmp-under', field);
  const count = el('div', 'cmp-count', field);

  let last = '';
  const render = (lines, sel, caret) => {
    const html = lines
      .map((line, i) => {
        const body = sel ? `<span class="sel">${escapeHtml(line)}</span>` : escapeHtml(line);
        const c = i === lines.length - 1 ? `<span class="caret" style="opacity:${caret.toFixed(2)}"></span>` : '';
        return `<div class="cmp-line">${body}${c}</div>`;
      })
      .join('');
    if (html !== last) {
      text.innerHTML = html;
      last = html;
    }
  };

  return {
    fit() {
      // 가장 긴 줄(+커서)이 줌 배율을 적용해도 화면 안에 들어오게
      render(cut.lines, false, 1);
      fitFont(text, [...text.querySelectorAll('.cmp-line')], CW / zoom - 24);
      render([''], false, 1);
    },
    update(f) {
      const on = f >= cut.start && f < cut.end;
      show(root, on);
      if (!on) return;
      const life = prog(f, cut.start, cut.end - cut.start);
      const punch = zoom > 1 ? lerp(1.05, 1, prog(f, cut.start, 6, E.outCubic)) : 1;
      inner.style.transform = `scale(${(zoom * punch * (1 + 0.02 * life)).toFixed(4)})`;
      let st = cut.states[0];
      for (const s of cut.states) {
        if (s.f > f) break;
        st = s;
      }
      render(st.lines, st.sel, caretAlpha(st, f));
      const n = st.lines.reduce((a, l) => a + Array.from(l).length, 0);
      count.textContent = `${n}/${S.maxChars}`;
    },
  };
}

// ── ② struggle: 올려놓은 게시물 (레드 라인에 위/아래로 갈라지도록 두 벌) ─────────
function postScene(half) {
  const P = TL.scenes.struggle.post;
  const S = SC.struggle.post;
  const T = TL.scenes.turn;
  const isTop = half === 'top';
  const root = el('div', 'scene dark post', stage);
  const inner = el('div', 'inner', root);
  el('div', 'post-head', inner).innerHTML = `${icon('chart')}<span>${escapeHtml(S.label)}</span>`;
  const card = el('div', 'post-card', inner);
  el('div', 'post-thumb', card).innerHTML =
    '<i class="shape s1"></i><i class="shape s2"></i><i class="shape s3"></i>' + `<span class="reel">${icon('play')}</span>`;
  const stats = el('div', 'post-stats', card);
  const stat = (name, value, label) => {
    const s = el('div', 'stat', stats);
    s.innerHTML = icon(name);
    if (label) el('span', 'lbl', s, label);
    return el('span', 'num', s, String(value));
  };
  const views = stat('play', S.views[0], '조회수');
  stat('heart', S.likes);
  stat('comment', S.comments);
  const text = textBlock(inner, [S.text], 'post-text', 'struggle.post');

  return {
    fit: () => text.fit(),
    update(f) {
      const on = f >= P.start && f <= T.split[1] && (isTop || f >= T.split[0]);
      show(root, on);
      if (!on) return;
      inner.style.transform = `scale(${(1 + 0.025 * prog(f, P.start, T.split[0] - P.start)).toFixed(4)})`;
      views.textContent = String(Math.round(lerp(S.views[0], S.views[1], prog(f, P.start + 2, 36, E.outCubic))));
      kinetic(text, f, P.start + 1, null, { stagger: 2, dur: 12, ellipsisLead: 2, dotGap: 3, ellipsisPause: 4 });
      if (f >= T.split[0]) {
        const k = prog(f, T.split[0], T.split[1] - T.split[0], E.inOutCubic);
        root.style.clipPath = isTop ? `inset(0 0 ${H - SPLIT_Y}px 0)` : `inset(${SPLIT_Y}px 0 0 0)`;
        root.style.transform = `translateY(${((isTop ? -1 : 1) * k * H * 0.56).toFixed(2)}px)`;
      } else {
        root.style.clipPath = 'none';
        root.style.transform = 'none';
      }
    },
  };
}

// ── 전환: 레드 라인 → 편집 룰 ─────────────────────────────────────────────
function redLineLayer() {
  const T = TL.scenes.turn;
  const node = el('div', 'redline', stage);
  return {
    update(f) {
      const on = f >= T.lineDraw[0] && f < T.exit;
      show(node, on);
      if (!on) return;
      const m = prog(f, T.morph[0], T.morph[1] - T.morph[0], E.inOutCubic);
      const h = lerp(8, 6, m);
      node.style.left = `${lerp(0, MX, m).toFixed(2)}px`;
      node.style.width = `${lerp(W, CW, m).toFixed(2)}px`;
      node.style.height = `${h.toFixed(2)}px`;
      node.style.top = `${(lerp(SPLIT_Y, RULE_Y, m) - h / 2).toFixed(2)}px`;
      const draw = prog(f, T.lineDraw[0], T.lineDraw[1] - T.lineDraw[0], E.outExpo);
      node.style.transform = `scaleX(${draw.toFixed(4)})`;
    },
  };
}

function creamLayer() {
  const T = TL.scenes.turn;
  const node = el('div', 'cream-bg', stage);
  return { update: (f) => show(node, f >= T.split[0]) };
}

// 전환 이후 상단에 계속 보이는 브랜드 표기 (랜딩 히어로: 빨간 점 + 문구). CTA 에서 로고로 이어진다
function brandMarkerLayer() {
  const T = TL.scenes.turn;
  const C = TL.scenes.cta;
  const node = el('div', 'brand-marker', stage);
  node.innerHTML = `<i class="dot"></i><span>${escapeHtml(config.brand.marker)}</span>`;
  return {
    update(f) {
      const on = f >= T.morph[0] && f < C.start;
      show(node, on);
      if (!on) return;
      const k = prog(f, T.morph[0] + 6, 10, E.outCubic);
      node.style.opacity = k.toFixed(3);
      node.style.transform = `translateY(${((1 - k) * 16).toFixed(2)}px)`;
    },
  };
}

// ── ③ turn: 혼자 애쓰지 마세요, 같이 정리해드릴게요 + ②의 질문들이 체크리스트로 ──────
function turnScene() {
  const T = TL.scenes.turn;
  const S = SC.turn;
  const root = el('div', 'scene cream turn', stage);
  const head = textBlock(root, S.headline, 'turn-head', 'turn.headline');
  const list = el('div', 'checklist', root);
  const rows = S.checklist.map((label, i) => {
    const row = el('div', 'check-row', list);
    row.dataset.key = `turn.check${i}`;
    const box = el('span', 'cbox', row);
    box.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" d="M5.6 12.6l4.1 4.1 8.7-8.9"/></svg>';
    const mask = el('span', 'check-mask', row);
    const text = el('span', 'check-text', mask, label);
    const rule = el('span', 'check-rule', row);
    return { row, box, tick: box.querySelector('path'), text, rule };
  });

  return {
    fit() {
      head.fit();
      const boxW = rows[0].box.getBoundingClientRect().width + 36;
      fitFont(list, rows.map((r) => r.text), CW - boxW);
    },
    update(f) {
      const on = f >= T.split[0] && f < T.exit; // 10초 박자에서 하드컷
      show(root, on);
      if (!on) return;
      kinetic(head, f, T.headlineAt, null, { stagger: 2, dur: 14, lineGap: T.lineGap });
      rows.forEach((r, i) => {
        const a = T.listAt + i * 3; // 체크 전: 빈 상자 + 흐린 글자로 먼저 등장
        const c = T.checkAt[i]; // 박자에 맞춰 빨간 체크
        const done = f >= c;
        r.row.style.opacity = f >= a ? '1' : '0';
        r.text.style.transform = `translateY(${((1 - prog(f, a, 12, E.outExpo)) * 110).toFixed(2)}%)`;
        r.text.style.color = `color-mix(in srgb, var(--ink) ${Math.round(lerp(34, 100, prog(f, c, 4)))}%, transparent)`;
        r.box.classList.toggle('on', done);
        const pop = done ? lerp(0.72, 1, prog(f, c, 9, E.outBack)) : lerp(0.5, 1, prog(f, a, 10, E.outBack));
        r.box.style.transform = `scale(${pop.toFixed(4)})`;
        r.tick.style.strokeDashoffset = (1 - prog(f, c + 1, 7, E.outCubic)).toFixed(4);
        r.rule.style.transform = `scaleX(${prog(f, a, 14, E.outCubic).toFixed(4)})`;
      });
    },
  };
}

// ── ④ trust: 1:1 — 처음부터 끝까지, 대표가 직접 함께해요 ──────────────────────
function trustScene() {
  const T = TL.scenes.trust;
  const S = SC.trust;
  const root = el('div', 'scene cream trust', stage);
  const badge = el('div', 'badge', root);
  badge.dataset.key = 'trust.badge';
  const [l, r] = S.badge.split(':');
  const digit = (text) => el('span', 'b-digit', el('span', 'b-mask', badge), text);
  const left = digit(l);
  const colon = el('span', 'b-colon', badge); // 로고와 같은 빨간 콜론 박스
  colon.innerHTML = '<i></i><i></i>';
  const right = digit(r);
  const tb = textBlock(root, S.lines, 'trust-text', 'trust.lines');

  return {
    fit: () => tb.fit(),
    update(f) {
      const on = f >= T.start && f < T.end; // 11.5초 박자에서 하드컷
      show(root, on);
      if (!on) return;
      const rise = (node, at) => {
        node.style.transform = `translateY(${((1 - prog(f, at, 12, E.outExpo)) * 105).toFixed(2)}%)`;
        node.style.opacity = f >= at ? '1' : '0';
      };
      rise(left, T.start);
      rise(right, T.start + 3);
      colon.style.transform = `scale(${prog(f, T.start + 2, 11, E.outBack).toFixed(4)})`;
      colon.style.opacity = f >= T.start + 2 ? '1' : '0';
      kinetic(tb, f, T.start + 6, null, { stagger: 2, dur: 13, lineGap: 2 });
    },
  };
}

// ── ④ setup: 올해가 가기 전에 ──────────────────────────────────────────────
function setupScene() {
  const T = TL.scenes.setup;
  const S = SC.setup;
  const root = el('div', 'scene cream setup', stage);
  const tb = textBlock(root, S.lines, 'setup-text', 'setup.lines');
  return {
    fit: () => tb.fit(),
    update(f) {
      const on = f >= T.start && f < T.end; // 13초 박자에서 하드컷 → CTA
      show(root, on);
      if (!on) return;
      kinetic(tb, f, T.start + 2, null, { stagger: 2, dur: 13, underlineAt: T.start + 14 });
    },
  };
}

// ── ⑤ CTA: 로고 타이포 + 버튼 + 주소 ────────────────────────────────────────
function ctaScene() {
  const T = TL.scenes.cta;
  const S = SC.cta;
  const root = el('div', 'scene cream cta', stage);
  const logo = el('div', 'logo', root);
  logo.dataset.key = 'cta.logo';
  const part = (cls, text) => el('span', `lg-part ${cls}`, el('span', 'lg-mask', logo), text);
  const left = part('', S.logo.left);
  const colon = el('span', 'lg-colon', logo);
  el('span', '', colon, S.logo.colon);
  const right = part('', S.logo.right);
  const suffix = part('lg-suffix', S.logo.suffix);

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

  const rowWidth = (node) => [...node.children].reduce((w, c) => w + c.getBoundingClientRect().width, 0);
  const fitBox = (node, maxW) => {
    const w = node.getBoundingClientRect().width;
    if (w > maxW) {
      const size = parseFloat(getComputedStyle(node).fontSize);
      node.style.fontSize = `${Math.floor(size * (maxW / w))}px`;
    }
  };

  return {
    fit() {
      const w = rowWidth(logo);
      if (w > CW) logo.style.fontSize = `${Math.floor(parseFloat(getComputedStyle(logo).fontSize) * (CW / w))}px`;
      fitBox(btn, CW);
      fitBox(url, CW);
    },
    update(f) {
      const on = f >= T.start;
      show(root, on);
      if (!on) return;
      const rise = (node, at, dur = 12) => {
        const k = prog(f, at, dur, E.outExpo);
        node.style.transform = `translateY(${((1 - k) * 110).toFixed(2)}%)`;
        node.style.opacity = f >= at ? '1' : '0';
      };
      rise(left, T.logoAt);
      rise(right, T.logoAt + 3);
      rise(suffix, T.logoAt + 7);
      const kc = prog(f, T.colonAt, 11, E.outBack);
      colon.style.transform = `scale(${kc.toFixed(4)})`;
      colon.style.opacity = f >= T.colonAt ? '1' : '0';

      const kb = prog(f, T.buttonAt, 13, E.outExpo);
      const press = f >= T.pressAt ? Math.sin(Math.PI * prog(f, T.pressAt, 8)) : 0;
      btn.style.transform = `translate(-50%, ${((1 - kb) * 70).toFixed(2)}px) scale(${(1 - 0.045 * press).toFixed(4)})`;
      btn.style.opacity = prog(f, T.buttonAt, 3).toFixed(3);
      const kr = prog(f, T.pressAt, 16, E.outCubic);
      ripple.style.transform = `scale(${(kr * 22).toFixed(3)})`;
      ripple.style.opacity = f >= T.pressAt ? (0.24 * (1 - kr)).toFixed(3) : '0';

      if (note) {
        const kn = prog(f, T.noteAt, 12, E.outExpo);
        note.style.transform = `translateY(${((1 - kn) * 30).toFixed(2)}px)`;
        note.style.opacity = prog(f, T.noteAt, 5).toFixed(3);
      }

      const ku = prog(f, T.urlAt, 13, E.outExpo);
      url.style.transform = `translate(-50%, ${((1 - ku) * 44).toFixed(2)}px)`;
      url.style.opacity = prog(f, T.urlAt, 4).toFixed(3);
    },
  };
}

// ── 조립 ──────────────────────────────────────────────────────────────────
const layers = [];

function build() {
  layers.push(hookScene());
  TL.scenes.struggle.cuts.forEach((_, i) => layers.push(composerScene(i)));
  layers.push(creamLayer());
  layers.push(postScene('top'), postScene('bottom'));
  layers.push(turnScene(), trustScene(), setupScene(), ctaScene(), brandMarkerLayer(), redLineLayer());
  layers.forEach((l) => l.fit && l.fit()); // 모든 요소가 기본 위치에 있을 때 크기 맞춤
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
      const textOnly = ['tb', 'cmp-text', 'check-row', 'cta-note'].some((c) => n.classList.contains(c));
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
