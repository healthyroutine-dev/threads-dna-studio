import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const states=JSON.parse(fs.readFileSync('states.json','utf8'));
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1080,height:640}});
for(const s of states){
  await p.goto('file://'+process.cwd()+'/panel.html');
  await p.evaluate(s=>render(s),s);
  await p.evaluate(()=>document.fonts.ready);
  await p.screenshot({path:`panel_${s.id}.png`});
}
await b.close();
