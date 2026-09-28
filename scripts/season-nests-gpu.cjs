const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../test-results/browser');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:process.env.RATTERY_BROWSER_CHANNEL||'msedge',headless:true,args:['--use-angle=d3d11']});
 const errors=[];const result={browser:browser.version(),scenarios:[]};
 try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>localStorage.setItem('rattery:welcome-explainer:v2','done'));
 await p.goto('http://localhost:5173/?season-preview=1');
 await p.waitForFunction(()=>window.__seasonScene?.diagnostics().nests.every(n=>n.mascots===2),{},{timeout:60000});
 result.gpu=await p.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL)});
 assert(!/SwiftShader|llvmpipe|software/i.test(result.gpu),'Hardware GPU required');
 await p.evaluate(()=>{for(const id of ['NVDA','AAPL','AMZN'])window.__seasonStore.getState().setScore(id,4000);window.__seasonAdvance(10)});
 await p.waitForTimeout(6000);
 async function sample(name,seconds){
 const measurement=await p.evaluate(seconds=>new Promise(resolve=>{
 const times=[];let first,last;
 function frame(t){if(first===undefined){first=last=t;requestAnimationFrame(frame);return}times.push(t-last);last=t;
 if(t-first<seconds*1000){requestAnimationFrame(frame);return}
 const sorted=[...times].sort((a,b)=>a-b);
 resolve({fps:1000*times.length/(t-first),p95FrameMs:sorted[Math.floor(sorted.length*.95)],frames:times.length,seconds:(t-first)/1000,telemetry:JSON.parse(document.querySelector('.burrow-host').dataset.performance),nests:window.__seasonScene.diagnostics()});
 }requestAnimationFrame(frame);
 }),seconds);
 result.scenarios.push({name,...measurement});console.log(name,JSON.stringify(measurement));
 }
 await sample('desktop-overview-1440x1000',12);
 await p.screenshot({path:path.join(out,'season-gpu-overview.png')});
 await p.getByRole('button',{name:'View nest',exact:true}).first().click();await p.waitForTimeout(2000);
 await sample('desktop-closeup',12);
 await p.getByRole('button',{name:'Attack FX',exact:true}).first().click();
 await sample('desktop-direct-attack',8);
 await p.getByRole('button',{name:'Shield FX',exact:true}).first().click();
 await p.waitForTimeout(300);
 await p.getByRole('button',{name:'Attack FX',exact:true}).first().click();
 await sample('desktop-shield-block',8);
 await p.getByRole('button',{name:'Feed +20',exact:true}).first().click();
 await sample('desktop-feed',5);
 await p.screenshot({path:path.join(out,'season-gpu-closeup.png')});
 await p.getByRole('button',{name:'Reveal winner',exact:true}).first().click();
 await sample('desktop-winner-effects',8);
 await p.getByRole('button',{name:'Overview',exact:true}).click();
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(2000);
 await sample('mobile-viewport-on-desktop-GPU-NOT-phone',8);
 await p.screenshot({path:path.join(out,'season-gpu-mobile-layout.png')});
 await p.emulateMedia({reducedMotion:'reduce'});
 for(const score of [0,4000,250,0]){
 await p.evaluate(score=>{for(const id of ['NVDA','AAPL','AMZN'])window.__seasonStore.getState().setScore(id,score)},score);
 await p.waitForFunction(score=>window.__seasonScene.diagnostics().nests.every(n=>n.score===score&&n.batchDraws>0&&n.mascotLods.every(l=>l>=1)),score);
 }
 assert.deepEqual(errors,[]);result.errors=errors;
 fs.writeFileSync(path.join(out,'season-gpu-results.json'),JSON.stringify(result,null,2));
 await ctx.close();
 const record=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out,size:{width:1440,height:1000}}});
 const v=await record.newPage();await v.addInitScript(()=>localStorage.setItem('rattery:welcome-explainer:v2','done'));
 await v.goto('http://localhost:5173/?season-preview=1');await v.waitForFunction(()=>window.__seasonScene?.diagnostics().nests.every(n=>n.mascots===2));
 await v.evaluate(()=>{for(const id of ['NVDA','AAPL','AMZN'])window.__seasonStore.getState().setScore(id,4000)});
 await v.waitForTimeout(8500);
 await v.getByRole('button',{name:'View nest',exact:true}).first().click();await v.waitForTimeout(2000);
 await v.getByRole('button',{name:'Attack FX',exact:true}).first().click();await v.waitForTimeout(8000);
 await v.getByRole('button',{name:'Shield FX',exact:true}).first().click();await v.waitForTimeout(300);
 await v.getByRole('button',{name:'Attack FX',exact:true}).first().click();await v.waitForTimeout(8000);
 await v.getByRole('button',{name:'Feed +20',exact:true}).first().click();await v.waitForTimeout(4000);
 await v.getByRole('button',{name:'Reveal winner',exact:true}).first().click();await v.waitForTimeout(6500);
 const video=v.video();await record.close();await video.saveAs(path.join(out,'season-nests-rtx4060ti.webm'));
 console.log('PASS GPU benchmark, tier reversal, mascot LOD and video recording');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});

