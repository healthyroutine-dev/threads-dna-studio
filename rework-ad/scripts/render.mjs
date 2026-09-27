// 렌더 파이프라인: 검사 → 오디오 합성 → 프레임 캡처(헤드리스 Chromium) → ffmpeg 인코딩 → 결과 검증
//   npm run render   mp4 만들기 (out/rework_ad_15s_9x16.mp4)
//   npm run check    노출 시간·세이프존 검사만
//   npm run stills   주요 장면 스틸 + 스토리보드 이미지 (out/storyboard.png)
// 옵션: --force (검사에 실패해도 계속)  --debug (스틸에 인스타 UI 영역 표시)

import { chromium } from 'playwright';
import ffmpegStatic from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import config from '../config.js';
import { buildTimeline, validate, plainText } from '../src/timeline.js';
import { startServer, ROOT } from './server.mjs';
import { renderAudio } from './audio.mjs';

const args = new Set(process.argv.slice(2));
const MODE = args.has('--check') ? 'check' : args.has('--stills') ? 'stills' : 'render';
const FORCE = args.has('--force');
const FFMPEG = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';
const { width: W, height: H, fps } = config.video;
const tl = buildTimeline(config);
const out = (p) => resolve(ROOT, p);
const rel = (p) => relative(process.cwd(), p) || p;
const fmtSec = (f) => (f / fps).toFixed(2);

function run(cmd, argv, feed) {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, argv, { stdio: [feed ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', fail);
    p.on('close', (code) => (code === 0 ? ok(err) : fail(new Error(`${cmd} 종료 코드 ${code}\n${err.slice(-2000)}`))));
    if (feed) feed(p.stdin).catch(fail);
  });
}

// ── 1. 노출 시간 검사 ────────────────────────────────────────────────────────
function checkTiming() {
  const v = validate(config, tl);
  console.log(`\n[검사] 문장 노출 시간 (최소 ${config.rules.minReadSec}초)`);
  for (const r of v.rows) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${fmtSec(r.appear).padStart(5)}s–${fmtSec(r.disappear).padStart(5)}s  ${r.sec.toFixed(2)}초  ${r.text}`);
  }
  v.errors.forEach((e) => console.log(`  ✗ ${e}`));
  return v.ok;
}

// ── 2. 세이프존 검사 (브라우저에서 실제 글자 위치를 잰다) ─────────────────────────
async function checkSafeZone(page) {
  const res = await page.evaluate(() => window.__checkSafe());
  const R = config.rules;
  console.log(`\n[검사] 인스타 UI 영역: 핵심 텍스트는 y ${R.safeTop}~${H - R.safeBottom}px, x ${R.safeSide}~${W - R.safeSide}px 안에`);
  for (const r of res) {
    const b = r.rect ? `y ${r.rect.top}~${r.rect.bottom}, x ${r.rect.left}~${r.rect.right}` : '측정 불가';
    console.log(`  ${r.ok ? '✓' : '✗'} ${fmtSec(r.frame).padStart(5)}s  ${b.padEnd(28)} ${r.text}`);
  }
  return res.every((r) => r.ok);
}

async function openPage(query = '') {
  const { server, url } = await startServer();
  const opts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  const browser = await chromium.launch(opts);
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${url}/src/index.html${query}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  if (errors.length) throw new Error(`페이지 오류:\n${errors.join('\n')}`);
  const cdp = await page.context().newCDPSession(page);
  return {
    url,
    page,
    browser,
    async capture(f) {
      await page.evaluate(
        (n) => new Promise((ok) => {
          window.renderFrame(n);
          requestAnimationFrame(() => requestAnimationFrame(ok));
        }),
        f,
      );
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, captureBeyondViewport: false });
      return Buffer.from(data, 'base64');
    },
    async close() {
      await browser.close();
      server.close();
    },
  };
}

// ── 3. 인코딩 ────────────────────────────────────────────────────────────────
async function encode(session, audioPath) {
  const output = out(config.video.output);
  await mkdir(resolve(output, '..'), { recursive: true });
  const argv = ['-hide_banner', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-'];
  if (audioPath) argv.push('-i', audioPath);
  argv.push(
    '-map', '0:v:0',
    ...(audioPath ? ['-map', '1:a:0'] : []),
    // 스크린샷(sRGB) → BT.709 limited range 로 정확히 변환 (레드·크림 색이 틀어지지 않게)
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', String(config.video.crf),
    '-profile:v', 'high', '-level:v', '4.2', '-g', String(fps), '-bf', '2',
    '-maxrate', '14M', '-bufsize', '28M',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-r', String(fps), '-frames:v', String(tl.total),
    ...(audioPath ? ['-c:a', 'aac', '-b:a', '256k', '-ar', String(config.audio.sampleRate), '-ac', '2'] : []),
    '-t', String(config.video.duration),
    '-movflags', '+faststart',
    output,
  );
  const started = Date.now();
  await run(FFMPEG, argv, async (stdin) => {
    for (let f = 0; f < tl.total; f++) {
      const png = await session.capture(f);
      if (!stdin.write(png)) await once(stdin, 'drain');
      if (f % 30 === 29 || f === tl.total - 1) {
        const pct = Math.round(((f + 1) / tl.total) * 100);
        process.stdout.write(`\r  프레임 ${f + 1}/${tl.total} (${pct}%) · ${((Date.now() - started) / 1000).toFixed(0)}초`);
      }
    }
    stdin.end();
  });
  process.stdout.write('\n');
  return output;
}

// ── 4. 결과 검증 ──────────────────────────────────────────────────────────────
// MP4 박스를 직접 읽어 정밀한 길이를 확인한다 (mvhd, 트랙별 edit list·mdhd·샘플 수)
async function mp4Info(file) {
  const b = await readFile(file);
  const info = { movie: NaN, tracks: [] };
  let track = null;
  const walk = (start, end) => {
    for (let p = start; p + 8 <= end; ) {
      let size = b.readUInt32BE(p);
      const type = b.toString('latin1', p + 4, p + 8);
      let hdr = 8;
      if (size === 1) {
        size = Number(b.readBigUInt64BE(p + 8));
        hdr = 16;
      } else if (size === 0) size = end - p;
      const d = p + hdr;
      const v = b[d];
      const u = (o, v1) => (v ? Number(b.readBigUInt64BE(d + v1)) : b.readUInt32BE(d + o));
      if (type === 'trak') info.tracks.push((track = {}));
      if (type === 'mvhd') info.movie = u(16, 24) / (v ? b.readUInt32BE(d + 20) : b.readUInt32BE(d + 12));
      if (type === 'hdlr') track.kind = b.toString('latin1', d + 8, d + 12);
      if (type === 'elst') track.edit = (v ? Number(b.readBigUInt64BE(d + 8)) : b.readUInt32BE(d + 8)) / 1000;
      if (type === 'mdhd') track.media = u(16, 24) / (v ? b.readUInt32BE(d + 20) : b.readUInt32BE(d + 12));
      if (type === 'stts') {
        let n = 0;
        for (let i = 0; i < b.readUInt32BE(d + 4); i++) n += b.readUInt32BE(d + 8 + i * 8);
        track.samples = n;
      }
      if (['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts'].includes(type)) walk(d, p + size);
      p += size;
    }
  };
  walk(0, b.length);
  return info;
}

async function verify(file) {
  const probe = await run(FFMPEG, ['-hide_banner', '-i', file, '-map', '0', '-c', 'copy', '-f', 'null', '-']);
  const video = /Stream #0:\d.*Video: (.*)/.exec(probe)?.[1] ?? '';
  const audio = /Stream #0:\d.*Audio: (.*)/.exec(probe)?.[1] ?? '';
  const mp4 = await mp4Info(file);
  const v = mp4.tracks.find((t) => t.kind === 'vide') || {};
  const a = mp4.tracks.find((t) => t.kind === 'soun');
  // 트랙 재생 길이 = edit list 구간 (오디오는 AAC 프라이밍을 건너뛰고 정확히 이 길이만 재생)
  const play = (t) => (t.edit ?? t.media);
  console.log(`\n[결과] ${rel(file)}`);
  console.log(`  길이: 전체 ${mp4.movie.toFixed(3)}초 · 영상 ${play(v).toFixed(3)}초 (${v.samples}프레임)${a ? ` · 음성 ${play(a).toFixed(3)}초` : ''}`);
  console.log(`  영상 ${video.replace(/\s*\(default\)/, '')}`);
  if (audio) console.log(`  음성 ${audio.replace(/\s*\(default\)/, '')}`);
  const D = config.video.duration;
  const exact = (x) => Math.abs(x - D) < 0.0005;
  const ok = exact(mp4.movie) && exact(play(v)) && v.samples === tl.total && (!a || exact(play(a))) && video.includes(`${W}x${H}`);
  console.log(ok ? `  ✓ 사양 일치: ${W}×${H}, ${fps}fps, 정확히 ${D}초` : '  ✗ 사양 불일치 — 위 값을 확인하세요');
  return ok;
}

async function contactSheet(file) {
  const sheet = out('out/contact_sheet.png');
  await run(FFMPEG, [
    '-hide_banner', '-y', '-i', file,
    '-vf', `select='not(mod(n\\,${fps / 2}))',scale=216:384:flags=lanczos,tile=10x3:padding=8:margin=8:color=0x7f7f7f`,
    '-frames:v', '1', '-update', '1', sheet,
  ]);
  return sheet;
}

// ── 스틸 + 스토리보드 ──────────────────────────────────────────────────────────
async function stills(session) {
  const S = tl.scenes;
  const C = config.scenes;
  const keys = [
    [S.hook.textAt + 24, '① 후킹 · 공감', 0, S.hook.end, plainText(C.hook.text.join(' '))],
    [S.struggle.cuts[0].typedEnd + 4, '② 막막함', S.struggle.cuts[0].start, S.struggle.cuts[0].end, C.struggle.cuts[0].lines.join(' ')],
    [S.struggle.cuts[1].typedEnd + 3, '② 막막함', S.struggle.cuts[1].start, S.struggle.cuts[1].end, C.struggle.cuts[1].lines.join(' ')],
    [S.turn.start - 5, '② 막막함', S.struggle.post.start, S.turn.start, C.struggle.post.text],
    [S.turn.split[0] + 4, '③ 전환', S.turn.start, S.turn.split[1], '레드 라인이 화면을 가르고 크림 톤으로'],
    [S.turn.stepsAt[3] + 16, '③ 전환 · 방식', S.turn.headlineAt, S.turn.end, `${C.turn.headline.join(' ')} — ${C.turn.steps.join(' → ')}`],
    [S.value.start + 22, '④ 가치', S.value.start, S.value.end, plainText(C.value.slogan.join(' '))],
    [S.setup.start + 28, '④ 가치', S.setup.start, S.setup.end, plainText(C.setup.lines.join(' '))],
    [S.cta.urlAt + 16, '⑤ CTA', S.cta.start, tl.total, `${C.cta.button} · ${C.cta.url}`],
  ];
  const dir = out('out/stills');
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const cells = [];
  for (const [i, [f, scene, a, b, copy]] of keys.entries()) {
    const name = `${String(i + 1).padStart(2, '0')}_f${String(f).padStart(3, '0')}.png`;
    await writeFile(resolve(dir, name), await session.capture(f));
    cells.push({ name, scene, range: `${fmtSec(a)}–${fmtSec(b)}s`, copy });
  }
  // 스토리보드 한 장 (같은 브랜드 토큰으로 조판)
  const c = config.colors;
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="/src/styles.css"><style>
    html{background:${c.cream}}
    body{width:1800px;height:auto;background:${c.cream};color:${c.ink};font-family:'Pretendard Variable',sans-serif;padding:56px 64px 64px;overflow:visible;word-break:keep-all}
    h1{font-size:40px;font-weight:900;letter-spacing:-.03em} h1 i{font-style:normal;color:${c.red}}
    .sub{margin-top:10px;font-size:20px;color:color-mix(in srgb,${c.ink} 55%,transparent)}
    .grid{margin-top:40px;display:grid;grid-template-columns:repeat(9,1fr);gap:18px}
    .cell img{width:100%;display:block;border-radius:10px;box-shadow:0 0 0 1px color-mix(in srgb,${c.ink} 14%,transparent)}
    .range{margin-top:14px;font-size:15px;font-weight:800;color:${c.red};font-variant-numeric:tabular-nums}
    .meta{margin-top:2px;font-size:16px;font-weight:800}
    .copy{margin-top:6px;font-size:15px;line-height:1.45;word-break:keep-all}
  </style></head><body>
    <h1>RE<i>:</i>WORK STUDIO — 15초 광고 스토리보드</h1>
    <div class="sub">1080×1920 · 30fps · 450프레임 · ${rel(out(config.video.output))} · ${config.scenes.cta.url}</div>
    <div class="grid">${cells.map((x) => `<div class="cell"><img src="/out/stills/${x.name}"><div class="range">${x.range}</div><div class="meta">${x.scene}</div><div class="copy">${x.copy}</div></div>`).join('')}</div>
  </body></html>`;
  const sb = await session.browser.newPage({ viewport: { width: 1800, height: 400 }, deviceScaleFactor: 1 });
  await sb.goto(`${session.url}/src/index.html`); // 같은 출처에서 열어 폰트·이미지를 불러온다
  await sb.setContent(html, { waitUntil: 'load' });
  await sb.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((r) => (im.onload = r)))));
  });
  const png = out('out/storyboard.png');
  await sb.screenshot({ path: png, fullPage: true });
  await sb.close();
  console.log(`\n[스틸] ${rel(dir)}/ (${cells.length}장) · 스토리보드 ${rel(png)}`);
}

// ── 실행 ──────────────────────────────────────────────────────────────────────
const t0 = Date.now();
const timingOk = checkTiming();
const session = await openPage(MODE === 'stills' && args.has('--debug') ? '?debug=1' : '');
try {
  const safeOk = await checkSafeZone(session.page);
  if (!(timingOk && safeOk) && !FORCE) {
    console.log('\n✗ 검사를 통과하지 못했습니다. config.js 를 고치거나 --force 로 강제 진행하세요.');
    process.exitCode = 1;
  } else if (MODE === 'stills') {
    await stills(session);
  } else if (MODE === 'render') {
    let audioPath = null;
    if (config.audio.enabled) {
      const a = await renderAudio(config, out('out/audio.wav'));
      audioPath = a.path;
      console.log(`\n[오디오] ${rel(a.path)} · ${a.seconds.toFixed(3)}초 · ${a.lufs.toFixed(1)} LUFS`);
    }
    console.log(`\n[렌더] ${tl.total}프레임 캡처 → ${FFMPEG === 'ffmpeg' ? 'ffmpeg' : 'ffmpeg-static'} 인코딩`);
    const file = await encode(session, audioPath);
    const ok = await verify(file);
    const sheet = await contactSheet(file);
    console.log(`  컨택트 시트 ${rel(sheet)} (0.5초 간격 30컷)`);
    if (!ok) process.exitCode = 1;
  }
} finally {
  await session.close();
}
console.log(`\n완료 · ${((Date.now() - t0) / 1000).toFixed(1)}초`);
