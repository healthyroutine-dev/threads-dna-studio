// 오디오 공용 도구: RBJ 바이쿼드 필터, ITU-R BS.1770 라우드니스 측정

// 한 샘플씩 처리하는 바이쿼드 (Robert Bristow-Johnson 'Audio EQ Cookbook')
// type: lp | hp | bp | peak | lowshelf | highshelf  (peak·shelf 는 gainDb 사용)
export function biquad(sr, type, f0, Q = Math.SQRT1_2, gainDb = 0) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * f0) / sr;
  const cs = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp' || type === 'hp') {
    const s = type === 'lp' ? 1 : -1;
    b0 = (1 - s * cs) / 2;
    b1 = s * (1 - s * cs);
    b2 = b0;
    [a0, a1, a2] = [1 + alpha, -2 * cs, 1 - alpha];
  } else if (type === 'bp') {
    [b0, b1, b2] = [alpha, 0, -alpha];
    [a0, a1, a2] = [1 + alpha, -2 * cs, 1 - alpha];
  } else if (type === 'peak') {
    [b0, b1, b2] = [1 + alpha * A, -2 * cs, 1 - alpha * A];
    [a0, a1, a2] = [1 + alpha / A, -2 * cs, 1 - alpha / A];
  } else {
    const k = 2 * Math.sqrt(A) * alpha;
    const s = type === 'lowshelf' ? 1 : -1;
    b0 = A * (A + 1 - s * (A - 1) * cs + k);
    b1 = 2 * s * A * (A - 1 - s * (A + 1) * cs);
    b2 = A * (A + 1 - s * (A - 1) * cs - k);
    a0 = A + 1 + s * (A - 1) * cs + k;
    a1 = -2 * s * (A - 1 + s * (A + 1) * cs);
    a2 = A + 1 + s * (A - 1) * cs - k;
  }
  [b0, b1, b2, a1, a2] = [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
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

// 필터 여러 개를 차례로 통과시킨 새 배열
export function filter(x, filters) {
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    let v = x[i];
    for (const f of filters) v = f(v);
    y[i] = v;
  }
  return y;
}

export const dbToGain = (db) => Math.pow(10, db / 20);

// ITU-R BS.1770 적분 라우드니스 (LUFS). 모노는 L·R 에 같은 배열을 넘긴다
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
  const kr = R === L ? kl : kw(R);
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
  if (!abs.length) return -Infinity;
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const rel = lufs(mean(abs)) - 10;
  return lufs(mean(abs.filter((v) => lufs(v) > rel)));
}

// 피크 리미터: 앞을 내다보며(look) 넘칠 샘플만 미리 부드럽게 눌러 ceiling(선형) 아래로. 채널들은 같은 이득으로 묶어 처리
export function limiter(channels, sr, ceiling, { look = 0.004, release = 0.06 } = {}) {
  const N = channels[0].length;
  const L = Math.max(1, Math.round(look * sr));
  const need = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let p = 0;
    for (const ch of channels) p = Math.max(p, Math.abs(ch[i]));
    need[i] = p > ceiling ? ceiling / p : 1;
  }
  // 앞쪽 L 샘플 안의 최소 이득 → 박스 평활 → 느린 복귀 (클릭 없이 피크만 누름)
  const fwdMin = new Float32Array(N);
  const dq = [];
  for (let i = N - 1; i >= 0; i--) {
    while (dq.length && need[dq[dq.length - 1]] >= need[i]) dq.pop();
    dq.push(i);
    while (dq[0] > i + L) dq.shift();
    fwdMin[i] = need[dq[0]];
  }
  const rel = Math.exp(-1 / (release * sr));
  let acc = L; // 시작 전 구간은 이득 1로 채워진 것으로 본다
  let g = 1;
  let minGain = 1;
  let over3 = 0; // 3dB 넘게 누른 샘플 수
  const out = channels.map(() => new Float32Array(N));
  for (let i = 0; i < N; i++) {
    acc += fwdMin[i] - (i >= L ? fwdMin[i - L] : 1);
    const box = Math.min(1, acc / L);
    g = Math.min(box, g * rel + (1 - rel) * box);
    minGain = Math.min(minGain, g);
    if (g < 0.7079) over3++;
    channels.forEach((ch, c) => (out[c][i] = ch[i] * g));
  }
  return { out, reductionDb: -20 * Math.log10(minGain), over3Sec: over3 / sr };
}
