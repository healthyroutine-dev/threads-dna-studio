import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const plan=JSON.parse(fs.readFileSync('plan.json','utf8'));
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1080,height:1920}});
let i=0;
for(const s of plan.segs){
  await p.goto('file://'+process.cwd()+(s.endcard?'/endcard.html':'/overlay.html'));
  if(s.endcard){await p.evaluate(x=>render(x),{no:plan.meta.no,items:s.items});await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:`ov_${String(i).padStart(2,'0')}.png`,omitBackground:true});i++;continue;}
  await p.evaluate(s=>render(s),{lit:s.lit,h1:s.h1,h2:s.h2,now:s.now,pause:s.pause,pip:s.pip,quote:s.quote,meta:plan.meta,handle:plan.handle});
  await p.evaluate(()=>document.fonts.ready);
  await p.evaluate(()=>{const hl=document.querySelector('.hl');let f=86;hl.style.fontSize=f+'px';while(hl.offsetHeight>172&&f>44){f-=2;hl.style.fontSize=f+'px';}});  // 글꼴 로딩 후 제목 크기 다시 맞춤
  await p.screenshot({path:`ov_${String(i).padStart(2,'0')}.png`,omitBackground:true});
  i++;
}
await b.close();
