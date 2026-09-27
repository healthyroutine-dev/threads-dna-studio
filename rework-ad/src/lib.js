// 애니메이션 공용 도우미 — 모든 값은 프레임 번호만으로 결정됩니다 (결정적 렌더링).

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;

export const E = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

// f 프레임에서 [start, start+dur] 구간의 진행률 (0~1, easing 적용)
export const prog = (f, start, dur, ease = E.linear) =>
  dur <= 0 ? (f >= start ? 1 : 0) : ease(clamp((f - start) / dur));

export function el(tag, cls, parent, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

export const show = (node, on) => {
  const v = on ? '' : 'none';
  if (node.style.display !== v) node.style.display = v;
};

export const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// "[스토리]" → 빨간 대괄호 강조, "{제대로 세팅}" → 빨간 밑줄 강조
export function parseMarkup(str) {
  const out = [];
  const re = /\[([^\]]+)\]|\{([^}]+)\}/g;
  let last = 0;
  let m;
  while ((m = re.exec(str))) {
    if (m.index > last) out.push({ text: str.slice(last, m.index) });
    out.push(m[1] !== undefined ? { text: m[1], accent: 'bracket' } : { text: m[2], accent: 'underline' });
    last = re.lastIndex;
  }
  if (last < str.length) out.push({ text: str.slice(last) });
  return out;
}

// 요소 안 글자들이 실제로 차지하는 사각형 (line-height 여백 제외)
export function textRect(node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
  if (!rects.length) return null;
  return rects.reduce((a, r) => ({
    left: Math.min(a.left, r.left),
    top: Math.min(a.top, r.top),
    right: Math.max(a.right, r.right),
    bottom: Math.max(a.bottom, r.bottom),
  }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
}

// 글자(텍스트 노드)만의 사각형 — 세이프존 검사용
export function inkRect(node) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let box = null;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.textContent.trim()) continue;
    range.selectNodeContents(t);
    for (const r of range.getClientRects()) {
      if (!r.width || !r.height) continue;
      box = box
        ? { left: Math.min(box.left, r.left), top: Math.min(box.top, r.top), right: Math.max(box.right, r.right), bottom: Math.max(box.bottom, r.bottom) }
        : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }
  }
  return box;
}

export const contentWidth = (node) => {
  const r = textRect(node);
  return r ? r.right - r.left : 0;
};

// 가장 긴 줄이 maxWidth 안에 들어오도록 글자 크기를 줄인다 (문구를 바꿔도 넘치지 않게)
export function fitFont(block, lineNodes, maxWidth) {
  for (let i = 0; i < 3; i++) {
    const widest = Math.max(...lineNodes.map(contentWidth));
    if (widest <= maxWidth) return;
    const size = parseFloat(getComputedStyle(block).fontSize);
    block.style.fontSize = `${Math.floor(size * (maxWidth / widest) * 2) / 2}px`;
  }
}
