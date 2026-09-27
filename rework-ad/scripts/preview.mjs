// 브라우저 미리보기: 재생·탐색·인스타 UI 영역 표시. config.js 를 고치고 새로고침하면 바로 반영됩니다.
// BGM 도 최신 설정으로 먼저 다시 합성합니다.
import { renderAudio } from './audio.mjs';
import { startServer } from './server.mjs';

const port = Number(process.env.PORT || 4173);
if (process.argv.includes('--no-audio')) console.log('BGM 합성 건너뜀');
else {
  const a = await renderAudio();
  console.log(`BGM 합성: out/audio.wav (${a.lufs.toFixed(1)} LUFS)`);
}
const { url } = await startServer(port);
console.log(`\n미리보기: ${url}/src/preview.html\n(종료: Ctrl+C)`);
