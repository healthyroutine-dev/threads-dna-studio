// BGM + 효과음을 코드로 합성하고 내레이션(대표님 녹음)과 섞습니다 (외부 음원·샘플 없음).
// 구간은 config.js → timeline 의 장면 시작 시간을 따라갑니다. 문구·타이밍을 바꾸면 소리도 같이 움직입니다.
//   0초 ~ 정곡      : A단조 인트로. 0초 임팩트, 4박 킥·16분 하이햇·펄스 베이스, 결제 알림음
//   정곡            : 스톱타임. 음악이 멈추고 말하는 단어마다 타격음 (마지막 단어는 크게)
//   원인            : 빌드업. 휩 소리, 드롭 박자에 맞춘 킥·스네어 롤·라이저 → 드롭 직전 잠깐 비움
//   답(드롭)~       : A장조 드롭. 임팩트·크래시, 하우스 그루브(오프비트 베이스·코드 스탭), 타일마다 플럭
//   마음            : 브레이크다운. 드럼이 빠지고 패드와 벨, 도장 소리 → 한 박 빌드업
//   CTA            : 마지막 드롭. 임팩트·차임·그루브 → 으뜸화음으로 마무리
// 목소리가 나오는 동안 음악은 config.voice.duck 만큼 내려간다 (저음은 절반만: 리듬은 살리고 말소리 대역만 비킨다)
// 단독 실행: `npm run audio` → out/audio.wav

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../config.js';
import { buildTimeline } from '../src/timeline.js';
import { biquad as makeBiquad, loudness, limiter, dbToGain } from './dsp.mjs';
import { hasVoice, voiceTrack } from './voice.mjs';

export { loudness };

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
const lerp = (a, b, t) => a + (b - a) * t;

// 코드: [베이스 루트, 패드·스탭 구성음]
const CH = {
  Am: ['A2', ['A3', 'C4', 'E4']],
  E7: ['E2', ['G#3', 'B3', 'D4']],
  A: ['A2', ['A3', 'C#4', 'E4']],
  E: ['E2', ['G#3', 'B3', 'E4']],
  Fsm: ['F#2', ['F#3', 'A3', 'C#4']],
  D: ['D2', ['F#3', 'A3', 'D4']],
};
const DROP_CHORDS = ['A', 'E', 'Fsm', 'D']; // 드롭: 1초마다 한 코드 (I–V–vi–IV)
const FINAL_CHORDS = ['A', 'E']; // CTA: I–V → 마지막 박에서 A 로 도착
const TILE_NOTES = ['A5', 'C#6', 'E6', 'A6', 'C#7', 'E7']; // 타일이 뜰 때마다 한 칸씩 오름
const STAMP_NOTES = ['A5', 'C#6', 'D6', 'F#6', 'A6']; // 도장이 찍힐 때마다
const TICK_NOTES = ['A5', 'B5', 'C6', 'D6', 'E6', 'F6', 'G#6']; // 지출 목록 한 줄마다 (A단조로 불안하게 올라감)

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

export function synthesize(cfg = config, { voice = false } = {}) {
  const tl = buildTimeline(cfg);
  const A = cfg.audio;
  const M = tl.music;
  const SR = A.sampleRate;
  const N = Math.round(cfg.video.duration * SR);
  const BEAT = 60 / A.bpm;
  const sec = (f) => f / tl.fps;
  const vMusic = A.volume.music;
  const vSfx = A.volume.sfx;
  const rand01 = mulberry32(20261231);
  const rnd = () => rand01() * 2 - 1;

  const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
  const music = bus(); // 킥에 맞춰 살짝 눌리는 버스 (베이스·패드·스탭)
  const drums = bus();
  const fx = bus();
  const revSend = bus();
  const dlySend = bus();
  const kicks = []; // 사이드체인용 킥 시간

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
      const p = panAt(t / dur);
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
    kicks.push(t0);
    let ph = 0;
    add(drums, t0, 0.45, (t) => {
      ph += (2 * Math.PI * (46 + 130 * Math.exp(-t / 0.03))) / SR;
      const body = Math.sin(ph) * Math.exp(-t / 0.2) * Math.min(1, t / 0.0015);
      return body + rnd() * Math.exp(-t / 0.002) * 0.2;
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
  function snare(t0, gain) {
    const bp = biquad('bp', 1900, 0.9);
    let ph = 0;
    add(drums, t0, 0.28, (t) => {
      ph += (2 * Math.PI * 190) / SR;
      return bp(rnd()) * Math.exp(-t / 0.08) * 1.6 + Math.sin(ph) * Math.exp(-t / 0.04) * 0.5;
    }, { gain: gain * vMusic, rev: 0.2 });
  }
  // 8분 → 16분 → 32분으로 빨라지며 커지는 스네어 롤
  function snareRoll(t0, t1, g0, g1) {
    let t = t0;
    while (t < t1 - 0.01) {
      const u = (t - t0) / (t1 - t0);
      snare(t, lerp(g0, g1, u * u));
      t += u < 0.45 ? BEAT / 2 : u < 0.8 ? BEAT / 4 : BEAT / 8;
    }
  }
  function crash(t0, gain) {
    const hp = biquad('hp', 5200, 0.7);
    add(drums, t0, 1.8, (t) => hp(rnd()) * Math.exp(-t / 0.5) * Math.min(1, t / 0.002), { gain: gain * vMusic, rev: 0.35 });
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
          const env = Math.min(1, t / 0.25) * (t > dur ? Math.exp(-(t - dur) / 0.18) : 1);
          return lp(saw, cutoffAt(t0 + t), 0.6) * env;
        }, { gain: (gain * vMusic) / Math.sqrt(notes.length * 2), pan, rev });
      }
    });
  }
  function pluck(t0, note, gain, pan, decay = 0.2, b = music) {
    const f = hz(note);
    let ph = 0, mph = 0;
    add(b, t0, decay * 5, (t) => {
      mph += (2 * Math.PI * f * 2) / SR;
      ph += (2 * Math.PI * f) / SR;
      const idx = 2.4 * Math.exp(-t / 0.028);
      return Math.sin(ph + idx * Math.sin(mph)) * Math.min(1, t / 0.002) * Math.exp(-t / decay);
    }, { gain: gain * vMusic, pan, dly: 0.25, rev: 0.12 });
  }
  // 오프비트 코드 스탭 (짧게 끊는 화음)
  function stab(t0, notes, gain, decay = 0.13) {
    notes.forEach((n, k) => pluck(t0, up(n, 12), gain / Math.sqrt(notes.length), (k - (notes.length - 1) / 2) * 0.3, decay));
  }
  function bell(b, t0, note, gain, pan = 0, len = 1.5, vol = vMusic) {
    const f = hz(note);
    const P = [[1, 1, 1], [2, 0.3, 0.5], [2.76, 0.2, 0.32], [5.4, 0.08, 0.16], [8.93, 0.04, 0.08]];
    const ph = P.map(() => 0);
    add(b, t0, len, (t) => {
      let v = 0;
      P.forEach(([r, a, d], k) => {
        ph[k] += (2 * Math.PI * f * r) / SR;
        v += a * Math.sin(ph[k]) * Math.exp(-t / (d * len * 0.35));
      });
      return v * Math.min(1, t / 0.0015);
    }, { gain: gain * vol, pan, rev: 0.45, dly: 0.1 });
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

  // ── 효과음 ──────────────────────────────────────────────────────────────
  // 임팩트: 깊은 서브 붐 + 크랙 (0초, 드롭, CTA)
  function impact(t0, gain) {
    let ph = 0;
    add(fx, t0, 1.4, (t) => {
      ph += (2 * Math.PI * (38 + 75 * Math.exp(-t / 0.06))) / SR;
      return Math.sin(ph) * Math.exp(-t / 0.45) * Math.min(1, t / 0.002);
    }, { gain: gain * vSfx });
    const bp = biquad('bp', 1800, 0.8);
    add(fx, t0, 0.5, (t) => bp(rnd()) * Math.exp(-t / 0.05) * 2.2, { gain: gain * 0.55 * vSfx, rev: 0.5 });
  }
  // 단어 타격음: 짧고 단단한 저음 + 스냅 (마지막 단어는 크고 길게)
  function hit(t0, gain, big) {
    let ph = 0;
    add(fx, t0, big ? 1.3 : 0.5, (t) => {
      ph += (2 * Math.PI * (big ? 40 + 110 * Math.exp(-t / 0.05) : 55 + 140 * Math.exp(-t / 0.03))) / SR;
      return Math.sin(ph) * Math.exp(-t / (big ? 0.3 : 0.12)) * Math.min(1, t / 0.0015);
    }, { gain: gain * vSfx });
    const bp = biquad('bp', big ? 1300 : 2300, 1.0);
    add(fx, t0, 0.35, (t) => bp(rnd()) * Math.exp(-t / (big ? 0.07 : 0.03)) * 2.2, { gain: gain * 0.5 * vSfx, rev: big ? 0.7 : 0.35 });
  }
  function subDrop(t0, gain) {
    let ph = 0;
    add(fx, t0, 0.9, (t) => {
      ph += (2 * Math.PI * (30 + 70 * Math.exp(-t / 0.22))) / SR;
      return Math.sin(ph) * Math.exp(-t / 0.45) * Math.min(1, t / 0.01);
    }, { gain: gain * vSfx });
  }
  // 지출 목록이 한 줄씩 올라올 때: 짧은 단음 '띵' (한 줄마다 음이 올라간다)
  function tick(t0, note, gain) {
    let ph = 0;
    const f = hz(note);
    add(fx, t0, 0.1, (t) => {
      ph += (2 * Math.PI * f) / SR;
      return Math.sin(ph) * Math.exp(-t / 0.028) * Math.min(1, t / 0.002);
    }, { gain: gain * vSfx, rev: 0.15, pan: 0.2 });
  }
  // 카드 결제 알림음: 짧은 두 음 '삐빅'
  function payBlip(t0, gain) {
    for (const [dt, fq] of [[0, 1760], [0.07, 2350]]) {
      let ph = 0;
      add(fx, t0 + dt, 0.12, (t) => {
        ph += (2 * Math.PI * fq) / SR;
        return Math.sin(ph) * Math.exp(-t / 0.035) * Math.min(1, t / 0.002);
      }, { gain: gain * vSfx, rev: 0.12 });
    }
  }
  function whoosh(t0, gain, pan) {
    noiseSweep(fx, t0 - 0.06, 0.42, { from: 6500, to: 700, peakAt: 0.25, Q: 0.9, gain: gain * vSfx, pan, rev: 0.25 });
  }
  function whooshUp(t0, gain) {
    noiseSweep(fx, t0 - 0.04, 0.34, { from: 700, to: 6000, peakAt: 0.65, Q: 1.1, gain: gain * vSfx, curve: 1.5, rev: 0.15 });
  }
  function thud(t0, gain) {
    let ph = 0;
    const lp = biquad('lp', 900, 0.7);
    add(fx, t0, 0.22, (t) => {
      ph += (2 * Math.PI * (105 + 60 * Math.exp(-t / 0.02))) / SR;
      return Math.sin(ph) * Math.exp(-t / 0.05) + lp(rnd()) * Math.exp(-t / 0.02) * 0.4;
    }, { gain: gain * vSfx });
  }
  function stampSound(t0, gain) {
    const bp = biquad('bp', 1100, 1.2);
    let ph = 0;
    add(fx, t0, 0.2, (t) => {
      ph += (2 * Math.PI * 160) / SR;
      return bp(rnd()) * Math.exp(-t / 0.012) * 2 + Math.sin(ph) * Math.exp(-t / 0.03) * 0.6;
    }, { gain: gain * vSfx, rev: 0.15 });
  }
  function tap(t0, gain) {
    const bp = biquad('bp', 2600, 1.2);
    let ph = 0;
    add(fx, t0, 0.08, (t) => {
      ph += (2 * Math.PI * 150) / SR;
      return bp(rnd()) * Math.exp(-t / 0.004) * 1.2 + Math.sin(ph) * Math.exp(-t / 0.018) * 0.5;
    }, { gain: gain * vSfx, rev: 0.15 });
  }

  // 하우스 그루브: 4박 킥, 2·4박 클랩, 오프비트 하이햇·베이스·코드 스탭 (+코드 패드)
  function groove(t0, t1, chords, { kickGain = 0.62, clap: clapGain = 0.24, stabGain = 0.2 } = {}) {
    const chordAt = (t) => chords[Math.min(chords.length - 1, Math.floor((t - t0 + 1e-6) / (BEAT * 2)))];
    for (let t = t0, b = 0; t < t1 - 1e-6; t += BEAT, b++) {
      kick(t, kickGain);
      if (b % 2 === 1) clap(t, clapGain);
      hat(t + BEAT / 2, 0.1, 0.15, 0.08);
      for (let s = 0; s < 4; s++) hat(t + (s * BEAT) / 4, [0.035, 0.02, 0.03, 0.02][s], s % 2 ? 0.3 : -0.2);
      const [root, notes] = CH[chordAt(t)];
      bass(t + BEAT / 2, BEAT * 0.42, root, 0.32, 0.9);
      bass(t, BEAT * 0.2, up(root, 12), 0.1, 0.5);
      stab(t + BEAT / 2, notes, stabGain);
    }
    for (let t = t0, i = 0; t < t1 - 1e-6; t += BEAT * 2, i++) {
      const [, notes] = CH[chords[Math.min(chords.length - 1, i)]];
      pad(t, Math.min(BEAT * 2, t1 - t), notes, 0.16, () => 2600, 0.25);
    }
  }

  const S = A.sfx;
  // ── ① 인트로 (A단조) — 첫 프레임부터 에너지. 스톱타임 직전에 딱 끊는다 ────────────────
  const beforeStop = (t) => t < M.stop - 0.01;
  if (S.impact) impact(0, 0.55);
  for (let t = 0, b = 0; beforeStop(t); t += BEAT, b++) {
    kick(t, b === 0 ? 0.3 : 0.5);
    for (let s = 0; s < 4; s++) if (beforeStop(t + (s * BEAT) / 4)) hat(t + (s * BEAT) / 4, [0.06, 0.028, 0.045, 0.028][s], s % 2 ? 0.25 : -0.15);
  }
  for (let t = 0, k = 0; beforeStop(t); t += BEAT / 2, k++) {
    bass(t, Math.min(BEAT * 0.38, M.stop - t), 'A2', k % 2 === 0 ? 0.3 : 0.2, 0.6);
    if (beforeStop(t + BEAT / 4)) pluck(t + BEAT / 4, ['E5', 'A5', 'C6', 'A5'][k % 4], 0.07, k % 2 ? 0.35 : -0.35, 0.12);
  }
  pad(0, M.stop, CH.Am[1], 0.14, () => 1100, 0.3);

  // ── ① 원인 → 빌드업: 킥·스네어 롤은 드롭 박자에서 거꾸로 맞춘다 (드롭 직전 gap 만큼 비움) ─────
  const gap = 0.06;
  for (let t = M.drop - BEAT; t > M.build - 1e-6; t -= BEAT) kick(t, 0.45);
  snareRoll(Math.max(M.build, M.drop - 3 * BEAT), M.drop - gap, 0.05, 0.26);
  noiseSweep(fx, M.build, M.drop - M.build - gap, { from: 300, to: 7500, peakAt: 0.97, Q: 1.4, gain: 0.32 * vMusic, curve: 2.3, rev: 0.1 });
  pad(M.build, M.drop - M.build - gap, CH.E7[1], 0.14, (t) => lerp(500, 3000, Math.min(1, (t - M.build) / (M.drop - M.build))), 0.2);

  // ── ② 드롭 (A장조) ───────────────────────────────────────────────────────
  if (S.impact) {
    impact(M.drop, 0.6);
    subDrop(M.drop, 0.4);
  }
  crash(M.drop, 0.16);
  groove(M.drop, M.breakdown, DROP_CHORDS);

  // ── ④ 브레이크다운 (감정) — 드럼이 빠지고 패드와 벨 → 마지막 한 박은 빌드업 ────────────
  const build2 = M.final - BEAT;
  const split = Math.min(build2, M.breakdown + Math.max(BEAT, Math.round(((build2 - M.breakdown) * 2) / 3 / BEAT) * BEAT));
  pad(M.breakdown, split - M.breakdown, CH.Fsm[1], 0.15, () => 1500, 0.45);
  bass(M.breakdown, split - M.breakdown, 'F#2', 0.1, 0.2);
  if (build2 > split) {
    pad(split, build2 - split, CH.D[1], 0.15, () => 1500, 0.45);
    bass(split, build2 - split, 'D2', 0.1, 0.2);
  }
  crash(M.breakdown, 0.08);
  pad(build2, M.final - build2 - gap, CH.E[1], 0.2, (t) => lerp(900, 3000, (t - build2) / (M.final - build2)), 0.3);
  bass(build2 + BEAT / 2, BEAT * 0.4, 'E2', 0.22, 0.8);
  kick(build2, 0.4);
  snareRoll(build2, M.final - gap, 0.08, 0.24);
  noiseSweep(fx, split, M.final - split - gap, { from: 400, to: 8000, peakAt: 0.97, Q: 1.3, gain: 0.26 * vMusic, curve: 2.2, rev: 0.1 });

  // ── ⑤ CTA 드롭 → 드롭 박자 위의 마지막 박에서 으뜸화음으로 마무리 ─────────────────────
  const lastHit = M.final + Math.max(1, Math.floor((M.end - 0.55 - M.final) / BEAT)) * BEAT;
  if (S.impact) {
    impact(M.final, 0.55);
    subDrop(M.final, 0.35);
  }
  crash(M.final, 0.16);
  groove(M.final, lastHit, FINAL_CHORDS, { kickGain: 0.6 });
  kick(lastHit, 0.6);
  crash(lastHit, 0.12);
  stab(lastHit, CH.A[1], 0.26, 0.5);
  pad(lastHit, M.end - lastHit, CH.A[1], 0.2, () => 2400, 0.4);
  bass(lastHit, M.end - lastHit - 0.05, 'A2', 0.3, 0.6);

  // ── 타임라인 이벤트 (화면과 프레임 단위로 일치) ─────────────────────────────
  for (const e of tl.events) {
    const t = e.t ?? sec(e.f); // 말에 맞춘 신호는 정확한 시각(초)으로
    switch (e.type) {
      case 'pay':
        if (S.pay) payBlip(t, voice ? 0.1 : 0.16); // 목소리와 같은 2kHz 대역이라 목소리 버전에선 작게
        break;
      case 'tick':
        if (S.pay) tick(t, TICK_NOTES[e.index % TICK_NOTES.length], voice ? 0.07 : 0.1);
        break;
      case 'hit':
        if (S.impact) hit(t, e.big ? 0.72 : e.soft ? 0.26 : 0.46, e.big);
        if (S.impact && e.big) subDrop(t, 0.2);
        break;
      case 'whip':
        if (S.whoosh) whoosh(t, 0.34, (u) => 0.8 - 1.6 * Math.min(1, u / 0.4)); // 오른쪽 → 왼쪽
        break;
      case 'thump':
        if (S.impact) hit(t, 0.4, false);
        break;
      case 'drop':
        if (S.whoosh) whoosh(t, 0.3, (u) => -0.8 + 1.6 * Math.min(1, u / 0.3)); // 레드 라인 방향: 왼쪽 → 오른쪽
        break;
      case 'tile':
        if (S.pop) pluck(t, TILE_NOTES[e.index % TILE_NOTES.length], 0.11, e.index % 2 ? 0.3 : -0.3, 0.16);
        break;
      case 'land':
        if (S.pop) thud(t, 0.22);
        break;
      case 'stamp':
        if (S.pop) stampSound(t, 0.3);
        bell(music, t, STAMP_NOTES[e.index % STAMP_NOTES.length], 0.13, e.index % 2 ? 0.2 : -0.2);
        break;
      case 'fly':
        if (S.whoosh) whooshUp(t, 0.26);
        break;
      case 'chime':
        if (S.cta) for (const note of ['A5', 'C#6', 'E6']) bell(fx, t + 0.02, note, 0.1, 0, 2.2, vSfx);
        break;
      case 'tap':
        if (S.tap) tap(t, 0.28);
        break;
      default:
        break;
    }
  }

  // ── 이펙트·마스터 ────────────────────────────────────────────────────────
  const delay = pingPong(dlySend, Math.round(BEAT * 0.75 * SR), 0.3, 3500, N, SR);
  const reverb = freeverb(revSend, N, SR);
  const duck = sidechain(kicks, N, SR);
  // 스템 두 개로 내보낸다: bed(음악 전체) · sfx(효과음). 목소리 버전에서 덕킹 양을 따로 준다
  const bed = bus();
  const sfx = bus();
  const hp = [biquad('hp', 32, 0.7), biquad('hp', 32, 0.7), biquad('hp', 32, 0.7), biquad('hp', 32, 0.7)];
  for (let i = 0; i < N; i++) {
    bed.L[i] = hp[0](music.L[i] * duck[i] + drums.L[i] + delay.L[i] * 0.5 + reverb.L[i] * 0.75);
    bed.R[i] = hp[1](music.R[i] * duck[i] + drums.R[i] + delay.R[i] * 0.5 + reverb.R[i] * 0.75);
    sfx.L[i] = hp[2](fx.L[i]);
    sfx.R[i] = hp[3](fx.R[i]);
  }
  // 끝 0.45초 페이드아웃 (영상이 정확히 15초에서 끝나도 소리가 뚝 끊기지 않게)
  const fadeN = Math.round(0.45 * SR);
  for (let i = N - fadeN; i < N; i++) {
    const g = Math.pow((N - i) / fadeN, 1.6);
    for (const b of [bed, sfx]) {
      b.L[i] *= g;
      b.R[i] *= g;
    }
  }
  return { bed, sfx, SR, N };
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

// 킥이 칠 때 음악 버스를 살짝 눌러 펌핑감을 만든다
function sidechain(kicks, N, SR) {
  const env = new Float32Array(N).fill(1);
  for (const t of kicks) {
    const i0 = Math.round(t * SR);
    for (let i = Math.max(0, i0); i < Math.min(N, i0 + Math.round(0.3 * SR)); i++) {
      const u = (i - i0) / SR;
      env[i] = Math.min(env[i], 1 - 0.38 * Math.exp(-u / 0.08) * Math.min(1, u / 0.004));
    }
  }
  return env;
}

// ── 음량: BS.1770 라우드니스를 목표 LUFS 로 맞추고 피크 리미터 (dsp.mjs) ────────────────
export function master(L, R, SR, targetLufs, ceilingDb = -1.8) {
  // 리미터가 피크를 누르면 음량이 조금 내려가므로, 목표에 0.1 LU 안으로 들어올 때까지 이득을 다시 맞춘다
  let gainDb = targetLufs - loudness(L, R, SR);
  let lim, lufs;
  for (let pass = 0; pass < 4; pass++) {
    const g = dbToGain(gainDb);
    lim = limiter([L.map((v) => v * g), R.map((v) => v * g)], SR, dbToGain(ceilingDb));
    lufs = loudness(lim.out[0], lim.out[1], SR);
    if (Math.abs(lufs - targetLufs) < 0.1) break;
    gainDb += targetLufs - lufs;
  }
  const [outL, outR] = lim.out;
  return { L: outL, R: outR, gainDb, limitDb: lim.reductionDb, lufs };
}

// ── 목소리 믹스 ──────────────────────────────────────────────────────────────
// 목소리가 있는 정도 (0~1). 조금 앞을 내다봐서 말이 시작되기 직전에 음악이 먼저 비켜 준다
function voicePresence(v, SR, { look = 0.05, attack = 0.03, release = 0.25, floor = -42, range = 12 } = {}) {
  const N = v.length;
  const decay = Math.exp(-1 / (0.01 * SR));
  const env = new Float32Array(N);
  for (let i = 0, e = 0; i < N; i++) env[i] = e = Math.max(Math.abs(v[i]), e * decay);
  const la = Math.round(look * SR);
  const aa = Math.exp(-1 / (attack * SR));
  const rr = Math.exp(-1 / (release * SR));
  const p = new Float32Array(N);
  for (let i = 0, s = 0; i < N; i++) {
    const db = 20 * Math.log10(env[Math.min(N - 1, i + la)] + 1e-9);
    const target = Math.min(1, Math.max(0, (db - floor) / range));
    s = target > s ? aa * s + (1 - aa) * target : rr * s + (1 - rr) * target;
    p[i] = s;
  }
  return p;
}

// 음악(bed)·효과음(sfx)을 목소리 아래로. 저음(180Hz 아래)은 덕킹을 절반만, 효과음은 60%만
export function mixVoice(song, voice, cfg = config) {
  const { SR, N, bed, sfx } = song;
  const V = cfg.voice;
  const sumL = bed.L.map((v, i) => v + sfx.L[i]);
  const sumR = bed.R.map((v, i) => v + sfx.R[i]);
  const mg = dbToGain(V.music - loudness(sumL, sumR, SR));
  const p = voicePresence(voice, SR);
  const lo = [0, 1].map(() => [makeBiquad(SR, 'lp', 180), makeBiquad(SR, 'lp', 180)]);
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  const musicL = new Float32Array(N);
  const musicR = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const d = p[i] * V.duck;
    const gHigh = dbToGain(-d);
    const gLow = dbToGain(-d * 0.5);
    const gFx = dbToGain(-d * 0.6);
    const lowL = lo[0][1](lo[0][0](bed.L[i]));
    const lowR = lo[1][1](lo[1][0](bed.R[i]));
    musicL[i] = mg * (lowL * gLow + (bed.L[i] - lowL) * gHigh + sfx.L[i] * gFx);
    musicR[i] = mg * (lowR * gLow + (bed.R[i] - lowR) * gHigh + sfx.R[i] * gFx);
    L[i] = musicL[i] + voice[i];
    R[i] = musicR[i] + voice[i];
  }
  // 문장마다 목소리가 음악보다 몇 LU 위에 있는지 (8~12 LU 면 음악 위에서도 또렷함)
  const tl = buildTimeline(cfg);
  const lines = tl.voice.map((v) => {
    const a = Math.round(v.at * SR);
    const b = Math.min(N, Math.round(v.end * SR));
    const vo = voice.subarray(a, b);
    return { id: v.id, voice: loudness(vo, vo, SR), music: loudness(musicL.subarray(a, b), musicR.subarray(a, b), SR) };
  });
  return { L, R, lines };
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

// 합성 → (목소리 믹스) → 음량 맞춤 → WAV 저장. voice: 목소리를 넣을지 (기본: config 에서 켜져 있고 녹음 파일이 있으면)
export async function renderAudio(cfg = config, outPath = resolve(ROOT, 'out/audio.wav'), { voice = hasVoice(cfg) } = {}) {
  const song = synthesize(cfg, { voice });
  const { SR } = song;
  let L, R, lines = null, voiceStats = null;
  if (voice) {
    const v = await voiceTrack(cfg);
    ({ L, R, lines } = mixVoice(song, v.track, cfg));
    voiceStats = v.stats;
  } else {
    L = song.bed.L.map((x, i) => x + song.sfx.L[i]);
    R = song.bed.R.map((x, i) => x + song.sfx.R[i]);
  }
  const m = master(L, R, SR, cfg.audio.loudness);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, wav16(m.L, m.R, SR));
  return { path: outPath, lufs: m.lufs, gainDb: m.gainDb, limitDb: m.limitDb, seconds: L.length / SR, voice: !!voice, lines, voiceStats };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const t = Date.now();
  const r = await renderAudio();
  console.log(`audio: ${r.path} · ${r.seconds.toFixed(3)}s · ${r.lufs.toFixed(1)} LUFS · 목소리 ${r.voice ? '있음' : '없음'} · ${((Date.now() - t) / 1000).toFixed(1)}s`);
  r.lines?.forEach((l) => console.log(`  ${l.id.padEnd(7)} 목소리 ${l.voice.toFixed(1)} · 음악 ${l.music.toFixed(1)} LUFS → 목소리가 ${(l.voice - l.music).toFixed(1)} LU 위`));
}
