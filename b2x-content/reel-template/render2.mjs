import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const plan=JSON.parse(fs.readFileSync('plan.json','utf8'));
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1080,height:1920}});
let i=0;
for(const s of plan.segs){
  await p.goto('file://'+process.cwd()+'/overlay.html');
  await p.evaluate(s=>render(s),{lit:s.lit,tr:s.tr,card:s.card?plan.cards[s.card]:null,handle:plan.handle});
  await p.evaluate(()=>document.fonts.ready);
  await p.screenshot({path:`ov_${String(i).padStart(2,'0')}.png`,omitBackground:true});
  i++;
}
await b.close();
