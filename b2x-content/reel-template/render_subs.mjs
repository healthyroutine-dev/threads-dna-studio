import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const subs=JSON.parse(fs.readFileSync('subs.json','utf8'));
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
for(let i=0;i<subs.length;i++){await p.goto('file://'+process.cwd()+'/subs.html');await p.evaluate(t=>render(t),subs[i]);await p.evaluate(()=>document.fonts.ready);
await p.screenshot({path:`sub_${String(i).padStart(2,'0')}.png`,omitBackground:true});}
await b.close();