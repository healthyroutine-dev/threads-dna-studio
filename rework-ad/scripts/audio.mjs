// BGM + 효과음을 코드로 합성합니다 (외부 음원·샘플 없음).
// 타이밍은 config.js → timeline 에서 가져오므로 문구·타이밍을 바꾸면 소리도 같이 따라갑니다.
//   0초 ~ 전환(7초)  : A단조, 미니멀 — 시계 틱, 낮은 펄스, 어두운 패드, 타이핑 소리, 라이저
//   전환 ~ 끝(15초)  : A장조, 밝고 경쾌 — 킥·클랩·셰이커, 플럭 아르페지오, 벨 멜로디
//   효과음           : 전환 스우시(레드 라인 방향으로 좌→우), CTA 팝·차임, 버튼 탭
// 단독 실행: `npm run audio` → out/audio.wav

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../config.js';
import { buildTimeline } from '../src/timeline.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const midi = (name) => {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(name);
  return 12 * (Number(m[2]) + 1) + NOTE[m[1]];
};
const hz = (name) => 440 * Math.pow(2, (midi(name) - 69) / 12);
const up = (name, semis) => {
  const n = midi(name) + semis;
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return `${names[n % 12]}${Math.floor(n / 12) - 1}`;
};

// 코드 진행: [베이스 루트, 패드 구성음]
const CHORDS = {
  Am: ['A2', ['A3', 'C4', 'E4', 'B4']],
  F: ['F2', ['F3', 'A3', 'C4', 'E4']],
  Dm: ['D2', ['D3', 'F3', 'A3', 'C4']],
  E7: ['E2', ['E3', 'G#3', 'B3', 'D4']],
  A: ['A2', ['A3', 'C#4', 'E4']],
  E: ['E2', ['G#3', 'B3', 'E4']],
  D: ['D2', ['F#3', 'A3', 'D4']],
};
const PART_A = ['Am', 'F', 'Dm']; // 마지막 마디는 E7 (A장조로 풀리기 직전의 긴장)
const PART_B = ['A', 'E', 'D']; // CTA 가 들어오는 마디는 A (으뜸화음으로 도착)
// 전반부 유리 모티프 (박 단위 위치, 음)
const GLASS = {
  Am: [[0, 'E5'], [1.5, 'C5'], [3, 'B4']],
  F: [[0, 'A4'], [1.5, 'C5'], [3, 'E5']],
  Dm: [[0, 'F5'], [1.5, 'D5'], [3, 'A4']],
  E7: [[0, 'G#4'], [1, 'B4']],
};
// 후반부 벨 멜로디 (마디별). 첫 마디는 체크리스트가 체크될 때 오르는 벨(CHECK_BELLS)이 대신한다
const MELODY = {
  E: [[0, 'B5'], [1, 'G#5'], [1.5, 'B5'], [2, 'E6']],
  D: [[0, 'A5'], [1, 'F#5'], [1.5, 'A5'], [2, 'D6'], [3, 'C#6']],
};
const CHECK_BELLS = ['A5', 'C#6', 'E6', 'A6']; // A장조 화음을 한 칸씩 오른다

// 결정적 난수 (매번 같은 소리가 나오도록)
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function synthesize(cfg = config) {
  const tl = buildTimeline(cfg);
  const A = cfg.audio;
  const SR = A.sampleRate;
  const N = Math.round(cfg.video.duration * SR);
  const END = N / SR;
  const BEAT = 60 / A.bpm;
  const BAR = BEAT * 4;
  const sec = (f) => f / tl.fps;
  const vMusic = A.volume.music;
  const vSfx = A.volume.sfx;
  const vType = A.volume.typing;
  const rand01 = mulberry32(20261231);
  const rnd = () => rand01() * 2 - 1;

  const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
  const music = bus();
  const drums = bus();
  const fx = bus();
  const revSend = bus();
  const dlySend = bus();

  // 한 음(보이스)을 버스에 더한다. gen(t)는 음 시작 후 t초의 샘플값.
  function add(b, t0, dur, gen, { gain = 1, pan = 0, rev = 0, dly = 0 } = {}) {
    const off = Math.round(t0 * SR);
    const i0 = Math.max(0, off);
    const i1 = Math.min(N, Math.round((t0 + dur) * SR));
    const panAt = typeof pan === 'function' ? pan : () => pan;
    const fadeN = Math.max(1, Math.min(Math.round(0.02 * SR), Math.floor((i1 - i0) / 4))); // 끝을 살짝 페이드 → 클릭 방지
    for (let i = i0; i < i1; i++) {
      const t = (i - off) / SR;
      const left = i1 - 1 - i;
      const v = gen(t) * gain * (left < fadeN ? left / fadeN : 1);
      const p = panAt(t);
      const l = v * Math.cos(((p + 1) * Math.PI) / 4) * Math.SQRT2;
      const r = v * Math.sin(((p + 1) * Math.PI) / 4) * Math.SQRT2;
      b.L[i] += l;
      b.R[i] += r;
      if (rev) {
        revSend.L[i] += l * rev;
        revSend.R[i] += r * rev;
      }
      if (dly) {
        dlySend.L[i] += l * dly;
        dlySend.R[i] += r * dly;
      }
    }
  }

  // ── 필터 ────────────────────────────────────────────────────────────────
  function biquad(type, f0, Q = 0.707) {
    const w0 = (2 * Math.PI * f0) / SR;
    const cs = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * Q);
    let b0, b1, b2;
    if (type === 'lp') [b0, b1, b2] = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2];
    else if (type === 'hp') [b0, b1, b2] = [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2];
    else [b0, b1, b2] = [alpha, 0, -alpha];
    const a0 = 1 + alpha;
    const a1 = (-2 * cs) / a0;
    const a2 = (1 - alpha) / a0;
    b0 /= a0;
    b1 /= a0;
    b2 /= a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return (x) => {
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      return y;
    };
  }
  // 컷오프가 움직이는 상태변수 필터 (TPT SVF)
  function svf() {
    let ic1 = 0, ic2 = 0;
    return (x, fc, Q = 0.707, mode = 'lp') => {
      const g = Math.tan((Math.PI * Math.min(fc, SR * 0.45)) / SR);
      const k = 1 / Q;
      const a1 = 1 / (1 + g * (g + k));
      const a2 = g * a1;
      const a3 = g * a2;
      const v3 = x - ic2;
      const v1 = a1 * ic1 + a2 * v3;
      const v2 = ic2 + a2 * ic1 + a3 * v3;
      ic1 = 2 * v1 - ic1;
      ic2 = 2 * v2 - ic2;
      return mode === 'bp' ? v1 : mode === 'hp' ? x - k * v1 - v2 : v2;
    };
  }
  const polyblep = (t, dt) => {
    if (t < dt) {
      const x = t / dt;
      return x + x - x * x - 1;
    }
    if (t > 1 - dt) {
      const x = (t - 1) / dt;
      return x * x + x + x + 1;
    }
    return 0;
  };

  // ── 악기 ────────────────────────────────────────────────────────────────
  function kick(t0, gain) {
    let ph = 0;
    add(drums, t0, 0.45, (t) => {
      ph += (2 * Math.PI * (46 + 120 * Math.exp(-t / 0.032))) / SR;
      const body = Math.sin(ph) * Math.exp(-t / 0.2) * Math.min(1, t / 0.0015);
      return body + rnd() * Math.exp(-t / 0.002) * 0.18;
    }, { gain: gain * vMusic });
  }
  function clap(t0, gain) {
    const bp = biquad('bp', 1500, 1.1);
    add(drums, t0, 0.4, (t) => {
      let env = t >= 0.022 ? Math.exp(-(t - 0.022) / 0.11) * 0.7 : 0;
      for (const d of [0, 0.011, 0.022]) if (t >= d) env = Math.max(env, Math.exp(-(t - d) / 0.005));
      return bp(rnd()) * env * 3;
    }, { gain: gain * vMusic, rev: 0.3 });
  }
  function hat(t0, gain, pan = 0, decay = 0.028) {
    const hp = biquad('hp', 7500, 0.8);
    add(drums, t0, decay * 7, (t) => hp(rnd()) * Math.exp(-t / decay) * Math.min(1, t / 0.0015), { gain: gain * vMusic, pan });
  }
  function tick(t0, gain, pan) {
    const hp = biquad('hp', 5000, 1);
    let ph = 0;
    add(drums, t0, 0.05, (t) => {
      ph += (2 * Math.PI * 2400) / SR;
      return hp(rnd()) * Math.exp(-t / 0.005) * 0.9 + Math.sin(ph) * Math.exp(-t / 0.0035) * 0.45;
    }, { gain: gain * vMusic, pan, rev: 0.12 });
  }
  function bass(t0, dur, note, gain, bright) {
    const f = hz(note);
    let ph = 0;
    add(music, t0, dur + 0.05, (t) => {
      ph += (2 * Math.PI * f) / SR;
      const tone = Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.25 * bright * Math.sin(3 * ph) + 0.12 * bright * Math.sin(4 * ph);
      const rel = t > dur ? Math.exp(-(t - dur) / 0.012) : 1;
      return tone * Math.min(1, t / 0.004) * Math.exp(-t / (dur * 0.9)) * rel;
    }, { gain: gain * vMusic });
  }
  function pad(t0, dur, notes, gain, cutoffAt, rev = 0.3) {
    notes.forEach((note, k) => {
      for (const det of [-0.07, 0.07]) {
        const f = hz(note) * Math.pow(2, det / 12);
        let ph = rand01();
        const lp = svf();
        const pan = (k / Math.max(1, notes.length - 1) - 0.5) * 0.6 * Math.sign(det);
        add(music, t0, dur + 0.5, (t) => {
          ph += f / SR;
          if (ph >= 1) ph -= 1;
          const saw = 2 * ph - 1 - polyblep(ph, f / SR);
          const env = Math.min(1, t / 0.3) * (t > dur ? Math.exp(-(t - dur) / 0.18) : 1);
          return lp(saw, cutoffAt(t0 + t), 0.6) * env;
        }, { gain: (gain * vMusic) / Math.sqrt(notes.length * 2), pan, rev });
      }
    });
  }
  function pluck(t0, note, gain, pan, decay = 0.2) {
    const f = hz(note);
    let ph = 0, mph = 0;
    add(music, t0, decay * 5, (t) => {
      mph += (2 * Math.PI * f * 2) / SR;
      ph += (2 * Math.PI * f) / SR;
      const idx = 2.4 * Math.exp(-t / 0.028);
      return Math.sin(ph + idx * Math.sin(mph)) * Math.min(1, t / 0.002) * Math.exp(-t / decay);
    }, { gain: gain * vMusic, pan, dly: 0.3, rev: 0.12 });
  }
  function bell(b, t0, note, gain, pan = 0, len = 1.5, vol = vMusic) {
    const f = hz(note);
    const P = [[1, 1, 1], [2, 0.3, 0.5], [2.76, 0.2, 0.32], [5.4, 0.08, 0.16], [8.93, 0.04, 0.08]];
    const ph = P.map(() => 0);
    add(b, t0, len, (t) => {
      let v = 0;
      P.forEach(([r, a, d], k) => {
        ph[k] += (2 * Math.PI * f * r) / SR;
        v += a * Math.sin(ph[k]) * Math.exp(-t / (d * len * 0.45));
      });
      return v * Math.min(1, t / 0.0015);
    }, { gain: gain * vol, pan, rev: 0.45, dly: 0.1 });
  }
  function glass(t0, note, gain, pan) {
    const f = hz(note);
    let ph = 0, ph3 = 0;
    add(music, t0, 1.8, (t) => {
      ph += (2 * Math.PI * f) / SR;
      ph3 += (2 * Math.PI * f * 3.01) / SR;
      return (Math.sin(ph) + 0.15 * Math.sin(ph3) * Math.exp(-t / 0.08)) * Math.min(1, t / 0.01) * Math.exp(-t / 0.5);
    }, { gain: gain * vMusic, pan, dly: 0.4, rev: 0.35 });
  }
  function noiseSweep(b, t0, dur, { from, to, peakAt = 0.5, Q = 1.2, gain, pan = 0, rev = 0.2, curve = 2 }) {
    const f = svf();
    add(b, t0, dur, (t) => {
      const u = t / dur;
      const fc = from * Math.pow(to / from, u);
      const env = u < peakAt ? Math.pow(u / peakAt, curve) : Math.exp(-((u - peakAt) / (1 - peakAt)) * 4);
      return f(rnd(), fc, Q, 'bp') * env * 2;
    }, { gain, pan, rev });
  }
  function keyClick(t0, gain, type) {
    const bp = biquad('bp', type === 'backspace' ? 2300 : 3000 + rand01() * 900, 1.5);
    const thump = type === 'enter' || type === 'delete' ? 120 : 175;
    let ph = 0;
    add(fx, t0, 0.06, (t) => {
      ph += (2 * Math.PI * thump) / SR;
      return bp(rnd()) * Math.exp(-t / 0.0045) * 1.6 + Math.sin(ph) * Math.exp(-t / 0.011) * 0.35;
    }, { gain: gain * vType * (0.85 + 0.3 * rand01()), pan: (rand01() - 0.5) * 0.3 });
  }
  function pop(t0, gain) {
    let ph = 0;
    add(fx, t0, 0.14, (t) => {
      ph += (2 * Math.PI * (560 + 900 * (1 - Math.exp(-t / 0.018)))) / SR;
      return Math.sin(ph) * Math.min(1, t / 0.001) * Math.exp(-t / 0.04);
    }, { gain: gain * vSfx, rev: 0.25 });
  }
  function tap(t0, gain) {
    const bp = biquad('bp', 2600, 1.2);
    let ph = 0;
    add(fx, t0, 0.08, (t) => {
      ph += (2 * Math.PI * 150) / SR;
      return bp(rnd()) * Math.exp(-t / 0.004) * 1.2 + Math.sin(ph) * Math.exp(-t / 0.018) * 0.5;
    }, { gain: gain * vSfx, rev: 0.15 });
  }

  // ── 편곡 ────────────────────────────────────────────────────────────────
  const turnT = sec(tl.scenes.turn.start);
  const ctaT = sec(tl.scenes.cta.start);

  // 전반부: 마디 나누기 (마지막 마디는 E7, 길이는 전환 시점에 맞춰 잘림)
  const barsA = [];
  for (let t = 0, k = 0; t < turnT - 1e-6; t += BAR, k++) barsA.push({ t, dur: Math.min(BAR, turnT - t), chord: PART_A[k % PART_A.length] });
  barsA[barsA.length - 1].chord = 'E7';
  const cutA = (t) => 500 + 1300 * Math.min(1, t / turnT); // 필터가 서서히 열리며 긴장감

  barsA.forEach((bar) => {
    const [root, notes] = CHORDS[bar.chord];
    pad(bar.t, bar.dur, notes, 0.2, cutA, 0.35);
    for (let s = 0; s < bar.dur - 1e-6; s += BEAT / 2) {
      const onBeat = Math.abs(s / BEAT - Math.round(s / BEAT)) < 1e-6;
      bass(bar.t + s, BEAT * 0.42, root, onBeat ? 0.2 : 0.12, 0.3);
    }
    for (const [b, note] of GLASS[bar.chord]) {
      if (b * BEAT < bar.dur - 0.05) glass(bar.t + b * BEAT, note, 0.08, b === 0 ? -0.3 : 0.3);
    }
  });
  // 시계 틱 (8분음표) — 알림이 도착하는 박자와 같다
  for (let t = 0, k = 0; t < turnT - 0.3; t += BEAT / 2, k++) tick(t, k % 2 === 0 ? 0.14 : 0.08, k % 2 === 0 ? -0.15 : 0.15);
  // 라이저: 전환 1초 전부터 차오르다 전환 직전에 멈춤
  noiseSweep(fx, turnT - 1.0, 0.97, { from: 300, to: 6000, peakAt: 0.97, Q: 1.6, gain: 0.3 * vMusic, curve: 2.2, rev: 0.1 });

  // 후반부: 전환 시점부터 2초 마디
  const barsB = [];
  for (let t = turnT, k = 0; t < END - 1e-6; t += BAR, k++) barsB.push({ t, dur: Math.min(BAR, END - t), chord: PART_B[k % PART_B.length] });
  barsB.forEach((bar) => {
    if (ctaT >= bar.t - 1e-6 && ctaT < bar.t + BAR) bar.chord = 'A';
  });
  const last = barsB[barsB.length - 1];
  const stopAt = END - BEAT; // 마지막 박에서 리듬을 멈추고 화음만 남긴다
  barsB.forEach((bar, bi) => {
    const [root, notes] = CHORDS[bar.chord];
    const isLast = bar === last;
    pad(bar.t, bar.dur + (isLast ? 0.3 : 0), notes, 0.3, () => 2600, 0.3);
    for (let b = 0; b < 4; b++) {
      const t = bar.t + b * BEAT;
      if (t >= stopAt) break;
      if (b % 2 === 0) kick(t, 0.5);
      else clap(t, 0.2);
      for (let s = 0; s < 4; s++) hat(t + (s * BEAT) / 4, [0.07, 0.035, 0.1, 0.04][s], s % 2 ? 0.25 : -0.1);
    }
    const bassPat = [0, 0, 12, 0, 0, 0, 12, 0];
    const arpIdx = [0, 1, 2, 3, 2, 1, 2, 3];
    const arpNotes = [...notes.map((n) => up(n, 12)), up(notes[0], 24)];
    for (let s = 0; s < 8; s++) {
      const t = bar.t + (s * BEAT) / 2;
      if (t >= stopAt) break;
      bass(t, BEAT * 0.4, up(root, bassPat[s]), 0.26, 0.9);
      if (bi > 0 || s >= 2) pluck(t, arpNotes[arpIdx[s] % arpNotes.length], 0.1, s % 2 ? 0.3 : -0.3);
    }
    for (const [b, note] of MELODY[bar.chord] || []) {
      if (bar.t + b * BEAT < stopAt && !(isLast && bar.chord === 'A')) bell(music, bar.t + b * BEAT, note, 0.12, 0.1);
    }
  });

  // ── 타임라인 이벤트: 타이핑, 4단계 벨, 효과음 ─────────────────────────────
  let lastKey = -1;
  for (const e of tl.events) {
    const t = sec(e.f);
    if (e.group === 'typing' && A.sfx.typing) {
      if (t - lastKey < 0.05) continue; // 너무 빠른 연타는 한 번으로
      lastKey = t;
      keyClick(t, e.type === 'select' ? 0.12 : 0.2, e.type);
    } else if (e.type === 'check') {
      // 체크리스트가 하나씩 체크될 때: 오르는 벨 + 작은 체크 소리
      bell(music, t, CHECK_BELLS[e.index % CHECK_BELLS.length], 0.15, e.index % 2 ? 0.2 : -0.2);
      if (A.sfx.check) tick(t, 0.1, e.index % 2 ? 0.15 : -0.15);
    } else if (e.type === 'transition' && A.sfx.transition) {
      // 레드 라인이 왼쪽→오른쪽으로 그어지는 방향으로 스우시가 지나간다
      noiseSweep(fx, t - 0.08, 0.5, { from: 7000, to: 700, peakAt: 0.22, Q: 0.9, gain: 0.34 * vSfx, pan: (u) => -0.8 + 1.6 * Math.min(1, u / 0.3), rev: 0.3 });
      for (const note of ['A5', 'E6', 'A6']) bell(fx, t + 0.02, note, 0.06, 0, 1.8, vSfx);
      noiseSweep(fx, t, 1.2, { from: 9000, to: 4000, peakAt: 0.02, Q: 0.5, gain: 0.05 * vSfx, rev: 0.4, curve: 1 });
    } else if (e.type === 'cta' && A.sfx.cta) {
      pop(t, 0.3);
      for (const note of ['A5', 'C#6', 'E6']) bell(fx, t + 0.03, note, 0.09, 0, 2.2, vSfx);
    } else if (e.type === 'tap' && A.sfx.tap) {
      tap(t, 0.25);
    }
  }

  // ── 이펙트·마스터 ────────────────────────────────────────────────────────
  const delay = pingPong(dlySend, Math.round(BEAT * 0.75 * SR), 0.32, 3500, N, SR);
  const reverb = freeverb(revSend, N, SR);
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  const duck = sidechain(barsB, BEAT, stopAt, N, SR);
  const hpL = biquad('hp', 35, 0.7);
  const hpR = biquad('hp', 35, 0.7);
  for (let i = 0; i < N; i++) {
    L[i] = hpL(music.L[i] * duck[i] + drums.L[i] + fx.L[i] + delay.L[i] * 0.55 + reverb.L[i] * 0.8);
    R[i] = hpR(music.R[i] * duck[i] + drums.R[i] + fx.R[i] + delay.R[i] * 0.55 + reverb.R[i] * 0.8);
  }
  // 끝 0.45초 페이드아웃 (영상이 정확히 15초에서 끝나도 소리가 뚝 끊기지 않게)
  const fadeN = Math.round(0.45 * SR);
  for (let i = N - fadeN; i < N; i++) {
    const g = Math.pow((N - i) / fadeN, 1.6);
    L[i] *= g;
    R[i] *= g;
  }
  return { L, R, SR, N };
}

function pingPong(src, d, fb, lpHz, N, SR) {
  const bufL = new Float32Array(N);
  const bufR = new Float32Array(N);
  const out = { L: new Float32Array(N), R: new Float32Array(N) };
  const a = Math.exp((-2 * Math.PI * lpHz) / SR);
  let zl = 0, zr = 0;
  for (let i = 0; i < N; i++) {
    const yl = i >= d ? bufL[i - d] : 0;
    const yr = i >= d ? bufR[i - d] : 0;
    zl = yl * (1 - a) + zl * a;
    zr = yr * (1 - a) + zr * a;
    bufL[i] = (src.L[i] + src.R[i]) * 0.5 + fb * zr;
    bufR[i] = fb * zl;
    out.L[i] = yl;
    out.R[i] = yr;
  }
  return out;
}

function freeverb(src, N, SR, room = 0.82, damp = 0.3) {
  const sc = SR / 44100;
  const combLens = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const apLens = [556, 441, 341, 225];
  const channel = (input, spread) => {
    const out = new Float32Array(N);
    const combs = combLens.map((n) => ({ buf: new Float32Array(Math.round((n + spread) * sc)), i: 0, z: 0 }));
    const aps = apLens.map((n) => ({ buf: new Float32Array(Math.round((n + spread) * sc)), i: 0 }));
    for (let s = 0; s < N; s++) {
      const x = input[s] * 0.015;
      let y = 0;
      for (const c of combs) {
        const o = c.buf[c.i];
        c.z = o * (1 - damp) + c.z * damp;
        c.buf[c.i] = x + c.z * room;
        c.i = (c.i + 1) % c.buf.length;
        y += o;
      }
      for (const ap of aps) {
        const b = ap.buf[ap.i];
        ap.buf[ap.i] = y + b * 0.5;
        ap.i = (ap.i + 1) % ap.buf.length;
        y = b - y;
      }
      out[s] = y * 3;
    }
    return out;
  };
  return { L: channel(src.L, 0), R: channel(src.R, 23) };
}

// 킥이 칠 때 음악 버스를 살짝 눌러 리듬감을 만든다
function sidechain(bars, beat, stopAt, N, SR) {
  const env = new Float32Array(N).fill(1);
  for (const bar of bars) {
    for (const b of [0, 2]) {
      const t = bar.t + b * beat;
      if (t >= stopAt) continue;
      const i0 = Math.round(t * SR);
      for (let i = i0; i < Math.min(N, i0 + Math.round(0.35 * SR)); i++) {
        const u = (i - i0) / SR;
        env[i] = Math.min(env[i], 1 - 0.3 * Math.exp(-u / 0.09) * Math.min(1, u / 0.004));
      }
    }
  }
  return env;
}

// ── 음량: ITU-R BS.1770 적분 라우드니스 측정 → 목표 LUFS 로 맞추고 피크 리미터 ─────────
export function loudness(L, R, SR) {
  if (SR !== 48000) throw new Error('라우드니스 측정은 48kHz 기준입니다 (config.audio.sampleRate = 48000)');
  const kw = (x) => {
    const out = new Float64Array(x.length);
    const stages = [
      [[1.53512485958697, -2.69169618940638, 1.19839281085285], [-1.69065929318241, 0.73248077421585]],
      [[1.0, -2.0, 1.0], [-1.99004745483398, 0.99007225036621]],
    ];
    let buf = Float64Array.from(x);
    for (const [[b0, b1, b2], [a1, a2]] of stages) {
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < buf.length; i++) {
        const y = b0 * buf[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = buf[i];
        y2 = y1;
        y1 = y;
        out[i] = y;
      }
      buf = Float64Array.from(out);
    }
    return buf;
  };
  const kl = kw(L);
  const kr = kw(R);
  const block = Math.round(0.4 * SR);
  const hop = Math.round(0.1 * SR);
  const z = [];
  for (let s = 0; s + block <= kl.length; s += hop) {
    let sl = 0, sr = 0;
    for (let i = s; i < s + block; i++) {
      sl += kl[i] * kl[i];
      sr += kr[i] * kr[i];
    }
    z.push((sl + sr) / block);
  }
  const lufs = (v) => -0.691 + 10 * Math.log10(v);
  const abs = z.filter((v) => lufs(v) > -70);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const rel = lufs(mean(abs)) - 10;
  return lufs(mean(abs.filter((v) => lufs(v) > rel)));
}

export function master(L, R, SR, targetLufs, ceilingDb = -1.8) {
  const gain = Math.pow(10, (targetLufs - loudness(L, R, SR)) / 20);
  const N = L.length;
  const ceil = Math.pow(10, ceilingDb / 20);
  const look = Math.round(0.004 * SR);
  const need = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const p = Math.max(Math.abs(L[i]), Math.abs(R[i])) * gain;
    need[i] = p > ceil ? ceil / p : 1;
  }
  // 앞을 내다보는 최소값 → 박스 평활 → 느린 릴리즈 (클릭 없이 피크만 누름)
  const fwdMin = new Float32Array(N);
  const dq = [];
  for (let i = N - 1; i >= 0; i--) {
    while (dq.length && need[dq[dq.length - 1]] >= need[i]) dq.pop();
    dq.push(i);
    while (dq[0] > i + look) dq.shift();
    fwdMin[i] = need[dq[0]];
  }
  const rel = Math.exp(-1 / (0.06 * SR));
  let acc = look; // 시작 전 구간은 이득 1로 채워진 것으로 본다
  let g = 1;
  const outL = new Float32Array(N);
  const outR = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    acc += fwdMin[i] - (i >= look ? fwdMin[i - look] : 1);
    const box = Math.min(1, acc / look);
    g = Math.min(box, g * rel + (1 - rel) * box);
    outL[i] = L[i] * gain * g;
    outR[i] = R[i] * gain * g;
  }
  return { L: outL, R: outR, gainDb: 20 * Math.log10(gain), lufs: loudness(outL, outR, SR) };
}

export function wav16(L, R, SR) {
  const N = L.length;
  const buf = Buffer.alloc(44 + N * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + N * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(N * 4, 40);
  const dither = mulberry32(7);
  for (let i = 0; i < N; i++) {
    for (const [c, x] of [[0, L[i]], [1, R[i]]]) {
      const d = (dither() - dither()) / 32768;
      buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round((x + d) * 32767))), 44 + i * 4 + c * 2);
    }
  }
  return buf;
}

// 합성 → 음량 맞춤 → WAV 저장
export async function renderAudio(cfg = config, outPath = resolve(ROOT, 'out/audio.wav')) {
  const { L, R, SR } = synthesize(cfg);
  const m = master(L, R, SR, cfg.audio.loudness);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, wav16(m.L, m.R, SR));
  return { path: outPath, lufs: m.lufs, gainDb: m.gainDb, seconds: L.length / SR };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const t = Date.now();
  const r = await renderAudio();
  console.log(`audio: ${r.path} · ${r.seconds.toFixed(3)}s · ${r.lufs.toFixed(1)} LUFS · ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
