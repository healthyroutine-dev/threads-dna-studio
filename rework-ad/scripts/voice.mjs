// 대표님 녹음(내레이션)을 다듬어 15초 타임라인에 배치합니다.
//   1) ffmpeg 로 원본(m4a·mp3·wav 등)을 48kHz 모노로 푼다
//   2) 다듬기 — 값은 이 녹음을 일반 말소리 평균 스펙트럼(LTASS)과 비교해 정했습니다
//      · 저역 컷 85Hz (24dB/oct)  : 63Hz 대역이 말소리 기준보다 16dB 많음 (바닥 울림·손 떨림)
//      · 명료도 +3.5dB @2.2kHz     : 1.2~3kHz 가 4~6dB 부족
//      · 치찰음 -3dB @9kHz + 디에서 : 8~10kHz 가 4~5dB 많음 ('ㅅ' 소리가 튀지 않게)
//      · 말끝 보정 (최대 +8dB)      : 문장 끝이 작아지며 사라지는 부분('거예요?')을 천천히 올림
//      · 컴프레서 3:1              : 문장 안 크기 차이를 줄여 음악 위에서도 또렷하게
//      · 마무리 EQ                 : 압축 후 밝아진 5kHz 위 -2.5dB, 450Hz +1.5dB (온기)
//      · 피크 리미터                : 음절 첫소리의 순간 피크를 눌러 피크/음량 비를 11dB 로 (믹스에서 음악이 출렁이지 않게)
//   3) 장면마다 config 의 녹음 구간(from~to)을 잘라 장면 위치에 놓고(앞 6ms·끝 30ms 페이드) 음량을 맞춘다
// 단독 실행: `npm run voice:scan` → 녹음에서 말소리 구간을 찾아 출력 (새로 녹음했을 때 from/to 고르기)

import ffmpegStatic from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../config.js';
import { buildTimeline } from '../src/timeline.js';
import { biquad, filter, loudness, limiter, dbToGain } from './dsp.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const FFMPEG = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';
const dB = (p) => 10 * Math.log10(p + 1e-12); // 파워 → dB
const PLR = 11; // 목소리 피크가 음량(LUFS)보다 최대 몇 dB 위까지 (방송 내레이션 10~12dB)

export const voiceFile = (cfg = config) => (cfg.voice?.file ? resolve(ROOT, cfg.voice.file) : null);
export const hasVoice = (cfg = config) => !!cfg.voice?.enabled && !!voiceFile(cfg) && existsSync(voiceFile(cfg));

// 녹음 파일 → Float32Array (모노, sr Hz)
export function decode(file, sr) {
  return new Promise((ok, fail) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', file, '-vn', '-f', 'f32le', '-ac', '1', '-ar', String(sr), '-']);
    const chunks = [];
    let err = '';
    p.stdout.on('data', (d) => chunks.push(d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', fail);
    p.on('close', (code) => {
      if (code !== 0) return fail(new Error(`녹음 파일을 읽지 못했습니다: ${file}\n${err}`));
      const b = Buffer.concat(chunks);
      const n = Math.floor(b.length / 4);
      ok(new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + n * 4)));
    });
  });
}

// 치찰음 완화: 5.5kHz 위 대역이 전체에서 차지하는 몫이 커질 때(= 'ㅅ·ㅆ·ㅈ·ㅊ') 그 대역만 잠깐 줄인다
function deess(x, sr, { freq = 5500, threshold = -8, maxCut = 6 } = {}) {
  const sib = filter(x, [biquad(sr, 'hp', freq), biquad(sr, 'hp', freq)]);
  const det = Math.exp(-1 / (0.004 * sr));
  const att = Math.exp(-1 / (0.001 * sr));
  const rel = Math.exp(-1 / (0.04 * sr));
  const y = new Float32Array(x.length);
  let ps = 1e-12, pa = 1e-12, g = 0;
  let cutMax = 0;
  for (let i = 0; i < x.length; i++) {
    ps = det * ps + (1 - det) * sib[i] * sib[i];
    pa = det * pa + (1 - det) * x[i] * x[i];
    const share = dB(ps) - dB(pa); // 0dB 에 가까울수록 치찰음
    const target = dB(ps) > -50 && share > threshold ? -Math.min(maxCut, (share - threshold) * 2) : 0;
    g = target < g ? att * g + (1 - att) * target : rel * g + (1 - rel) * target;
    cutMax = Math.min(cutMax, g);
    y[i] = x[i] - sib[i] * (1 - dbToGain(g)); // = 나머지 대역 + 줄인 치찰음 대역
  }
  return { y, cutMax };
}

// 말끝 보정: 150ms 평균 음량이 문장 평소 크기보다 많이 작은 곳을 천천히 올린다 (올리기만 함)
function levelTails(x, sr, { amount = 0.6, gap = 4, maxBoost = 8 } = {}) {
  const B = Math.round(0.01 * sr);
  const nb = Math.ceil(x.length / B);
  const p = new Float64Array(nb);
  for (let k = 0; k < nb; k++) {
    let s = 0;
    const end = Math.min(x.length, (k + 1) * B);
    for (let i = k * B; i < end; i++) s += x[i] * x[i];
    p[k] = s / B;
  }
  const W = 7; // ±70ms → 150ms 창
  const lv = Array.from(p, (_, k) => {
    let s = 0, c = 0;
    for (let j = Math.max(0, k - W); j <= Math.min(nb - 1, k + W); j++, c++) s += p[j];
    return dB(s / c);
  });
  const speech = lv.filter((v) => v > -45).sort((a, b) => a - b);
  const ref = speech[Math.floor(speech.length * 0.8)] ?? -20; // 평소 크기 (말소리 상위 20% 경계)
  // 아주 작은 소리(숨·잡음)는 올리지 않도록 -48~-38dB 사이에서 서서히 적용
  const want = lv.map((v) => Math.min(1, Math.max(0, (v + 48) / 10)) * Math.min(maxBoost, Math.max(0, amount * (ref - gap - v))));
  const S = 5; // 부드럽게 (±50ms 평균)
  const boost = want.map((_, k) => {
    let s = 0, c = 0;
    for (let j = Math.max(0, k - S); j <= Math.min(nb - 1, k + S); j++, c++) s += want[j];
    return s / c;
  });
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const u = i / B - 0.5;
    const k = Math.max(0, Math.min(nb - 2, Math.floor(u)));
    const t = Math.max(0, Math.min(1, u - k));
    y[i] = x[i] * dbToGain(boost[k] * (1 - t) + boost[k + 1] * t);
  }
  return { y, ref, boostMax: Math.max(...boost) };
}

// 컴프레서 (RMS 검출, 소프트 니)
function compress(x, sr, { threshold = -24, ratio = 3, knee = 6, attack = 0.002, release = 0.12, rms = 0.003 } = {}) {
  const ar = Math.exp(-1 / (rms * sr));
  const aa = Math.exp(-1 / (attack * sr));
  const rr = Math.exp(-1 / (release * sr));
  const y = new Float32Array(x.length);
  let p = 0, gr = 0, grMax = 0;
  for (let i = 0; i < x.length; i++) {
    p = ar * p + (1 - ar) * x[i] * x[i];
    const over = dB(p) - threshold;
    let red = 0;
    if (2 * Math.abs(over) <= knee) red = ((1 / ratio - 1) * (over + knee / 2) ** 2) / (2 * knee);
    else if (over > 0) red = (1 / ratio - 1) * over;
    gr = red < gr ? aa * gr + (1 - aa) * red : rr * gr + (1 - rr) * red;
    grMax = Math.min(grMax, gr);
    y[i] = x[i] * dbToGain(gr);
  }
  return { y, grMax };
}

export function processVoice(raw, sr) {
  const eq = filter(raw, [
    biquad(sr, 'hp', 85, 0.5412), // 4차 버터워스 하이패스 (0.5412 · 1.3066)
    biquad(sr, 'hp', 85, 1.3066),
    biquad(sr, 'peak', 2200, 0.8, 3.5),
    biquad(sr, 'peak', 9000, 1.2, -3),
  ]);
  const d = deess(eq, sr);
  const l = levelTails(d.y, sr);
  const c = compress(l.y, sr);
  // 압축하면 자음이 상대적으로 커져 5kHz 위가 밝아진다 → 살짝 눌러 주고, 400~500Hz 온기를 조금 채운다
  const y = filter(c.y, [biquad(sr, 'highshelf', 5000, 0.7, -2.5), biquad(sr, 'peak', 450, 1.0, 1.5)]);
  return { y, stats: { deessDb: d.cutMax, tailBoostDb: l.boostMax, compressDb: c.grMax } };
}

// 15초 길이의 목소리 트랙 (모노). 장면마다 녹음 구간을 잘라 제자리에 놓고 음량을 cfg.voice.loudness 로 맞춘다
export async function voiceTrack(cfg = config, tl = buildTimeline(cfg)) {
  const SR = cfg.audio.sampleRate;
  const raw = await decode(voiceFile(cfg), SR);
  const { y, stats } = processVoice(raw, SR);
  const N = Math.round(cfg.video.duration * SR);
  const track = new Float32Array(N);
  const fadeIn = Math.round(0.006 * SR);
  const fadeOut = Math.round(0.03 * SR);
  for (const line of tl.voice) {
    const a = Math.round(line.from * SR);
    const b = Math.min(y.length, Math.round(line.to * SR));
    const at = Math.round(line.at * SR);
    for (let i = a; i < b; i++) {
      const j = at + (i - a);
      if (j < 0 || j >= N) continue;
      const g = Math.min(1, (i - a) / fadeIn, (b - 1 - i) / fadeOut);
      track[j] += y[i] * g;
    }
  }
  // 음량 맞춤 → 피크 제한(음량 + PLR) → 제한으로 줄어든 만큼 다시 맞춤
  const target = cfg.voice.loudness;
  const scale = (x, db) => x.map((v) => v * dbToGain(db));
  let out = scale(track, target - loudness(track, track, SR));
  const lim = limiter([out], SR, dbToGain(target + PLR), { look: 0.003, release: 0.05 });
  out = scale(lim.out[0], target - loudness(lim.out[0], lim.out[0], SR));
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  return { track: out, SR, stats: { ...stats, limitDb: lim.reductionDb, limitOver3dbSec: lim.over3Sec, lufs: loudness(out, out, SR), peakDb: 20 * Math.log10(peak) } };
}

// 말소리 구간 찾기 (새 녹음의 from/to 고르기용). 짧게 끊긴 곳(0.09초 미만)은 한 구간으로 본다
export function findSpeech(x, sr) {
  const hp = filter(x, [biquad(sr, 'hp', 100)]);
  const hop = Math.round(0.005 * sr);
  const win = hop * 2;
  const lv = [];
  for (let i = 0; i + win <= hp.length; i += hop) {
    let s = 0;
    for (let j = 0; j < win; j++) s += hp[i + j] * hp[i + j];
    lv.push(dB(s / win));
  }
  const sorted = [...lv].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.08)];
  const peak = sorted[Math.floor(sorted.length * 0.99)];
  const on = Math.max(floor + 15, peak - 38);
  const off = on - 6;
  const t = (k) => (k * hop + win / 2) / sr;
  const regs = [];
  let start = -1;
  lv.forEach((v, k) => {
    if (start < 0 && v > on) {
      start = k;
      while (start > 0 && lv[start - 1] > off) start--;
    } else if (start >= 0 && v < off) {
      regs.push([start, k]);
      start = -1;
    }
  });
  if (start >= 0) regs.push([start, lv.length - 1]);
  const merged = [];
  for (const r of regs) {
    const last = merged[merged.length - 1];
    if (last && t(r[0]) - t(last[1]) < 0.09) last[1] = r[1];
    else merged.push([...r]);
  }
  return merged.map(([a, b]) => ({
    from: t(a) - 0.01,
    to: t(b) + 0.01,
    peak: Math.max(...lv.slice(a, b + 1)),
  }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2] ? resolve(process.argv[2]) : voiceFile();
  if (!file || !existsSync(file)) {
    console.log(`녹음 파일이 없습니다: ${file ?? '(config.voice.file 비어 있음)'}`);
    process.exit(1);
  }
  const x = await decode(file, 48000);
  const regs = findSpeech(x, 48000);
  console.log(`\n${file} · ${(x.length / 48000).toFixed(2)}초 · 말소리 구간 ${regs.length}개`);
  console.log('(작고 짧은 구간은 숨소리일 수 있습니다. 문장 구간을 config.js 장면의 voice.from / to 에 옮겨 적으세요)\n');
  for (const r of regs) {
    const quiet = r.peak < -30 || r.to - r.from < 0.4 ? '  ← 작음/짧음 (숨소리?)' : '';
    console.log(`  from: ${r.from.toFixed(3)}, to: ${r.to.toFixed(3)}   (${(r.to - r.from).toFixed(2)}초)${quiet}`);
  }
}
