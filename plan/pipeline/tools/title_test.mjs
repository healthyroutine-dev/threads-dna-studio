import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const T=JSON.parse(fs.readFileSync('/home/user/threads-dna-studio/plan/pipeline/titles.json','utf8'));
const dir=process.argv[2]; const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1080,height:1920}});
for(const [k,v] of Object.entries(T)){
  await p.goto('file://'+dir+'/overlay.html');
  const s={lit:[1],h1:v[0][0],h2:v[0][1],now:1,pause:'01 · TEST',pip:true,meta:{views:'4,2 M',mult:'429×',dur:'27 S'},handle:'@x · TikTok'};
  await p.evaluate(s=>render(s),s); await p.evaluate(()=>document.fonts.ready);
  await p.evaluate(()=>{const hl=document.querySelector('.hl');let f=86;hl.style.fontSize=f+'px';while(hl.offsetHeight>172&&f>44){f-=2;hl.style.fontSize=f+'px';}});
  await p.screenshot({path:`/tmp/claude-0/-home-user-threads-dna-studio/c2baa838-8d39-5050-9a2e-a92a98b07ab3/scratchpad/tt_${k}.png`,clip:{x:0,y:0,width:1080,height:600}});
}
await b.close();
