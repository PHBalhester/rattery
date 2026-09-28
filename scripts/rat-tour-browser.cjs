const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../test-results/browser');fs.mkdirSync(out,{recursive:true});const base=process.env.RATTERY_BASE_URL||'http://localhost:5176/';
(async()=>{const b=await chromium.launch({channel:process.env.RATTERY_BROWSER_CHANNEL||'msedge',headless:true,args:['--use-angle=d3d11']});try{
 const ctx=await b.newContext({viewport:{width:1440,height:1000}}),p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>localStorage.setItem('rattery:welcome-explainer:v2','done'));
 await p.goto(base);await p.waitForFunction(()=>document.querySelector('.burrow-host')?.dataset.rats==='blender'&&document.querySelector('.burrow-host')?.dataset.cameraFlight);
 const gpu=await p.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL)});
 assert(!/SwiftShader|llvmpipe/i.test(gpu));await p.waitForTimeout(3000);
 const state=()=>p.evaluate(()=>JSON.parse(document.querySelector('.burrow-host').dataset.cameraFlight));
 async function start(){await p.getByRole('button',{name:'Next rat',exact:true}).click();await p.waitForFunction(()=>JSON.parse(document.querySelector('.burrow-host').dataset.cameraFlight).active);}
 const flights=[];
 for(let i=0;i<6;i++){await start();flights.push(await p.evaluate(()=>new Promise(resolve=>{let first,last;const delta=[],progress=[];let planned=0;function frame(t){const s=JSON.parse(document.querySelector('.burrow-host').dataset.cameraFlight);if(first===undefined){first=last=t;}else{delta.push(t-last);last=t;}if(s.duration)planned=s.duration;progress.push(s.progress);if(s.active)return requestAnimationFrame(frame);const sorted=[...delta].sort((a,b)=>a-b);resolve({planned,elapsed:(t-first)/1000,fps:delta.length*1000/(t-first),p95Ms:sorted[Math.floor(sorted.length*.95)],monotonic:progress.every((x,i)=>!i||x>=progress[i-1])})}requestAnimationFrame(frame)})));}
 for(const f of flights){assert(f.monotonic);assert(f.planned>=.85&&f.planned<=1.7);assert(f.elapsed<2.1);}
 await start();await p.mouse.move(660,500);await p.mouse.down();await p.mouse.move(740,540,{steps:5});await p.mouse.up();await p.waitForFunction(()=>!JSON.parse(document.querySelector('.burrow-host').dataset.cameraFlight).active);assert.equal((await state()).focused,null);
 await start();await p.getByRole('button',{name:'Zoom in',exact:true}).click();await p.waitForFunction(()=>!JSON.parse(document.querySelector('.burrow-host').dataset.cameraFlight).active);
 await start();await p.emulateMedia({reducedMotion:'reduce'});await p.waitForFunction(()=>!JSON.parse(document.querySelector('.burrow-host').dataset.cameraFlight).active);
 const before=(await state()).focused;await p.keyboard.press('ArrowRight');await p.waitForFunction(before=>JSON.parse(document.querySelector('.burrow-host').dataset.cameraFlight).focused!==before,before);assert(!(await state()).active);
 await p.evaluate(()=>{const el=document.createElement('input');el.id='tour-input-test';document.body.append(el);el.focus()});const typed=(await state()).focused;await p.keyboard.press('ArrowLeft');assert.equal((await state()).focused,typed);await p.locator('#tour-input-test').evaluate(el=>el.remove());
 await p.emulateMedia({reducedMotion:'no-preference'});
 const mobile=[];
 for(const [width,height] of [[390,844],[360,740]]){
 await p.setViewportSize({width,height});if(await p.getByRole('button',{name:'Hide info',exact:true}).isVisible())await p.getByRole('button',{name:'Hide info',exact:true}).click();
 const openTab=p.locator('.dock-tab.is-colony[aria-pressed="true"],.dock-tab.is-rats[aria-pressed="true"]');if(await openTab.count())await openTab.first().click();
 await p.locator('.rat-tour').waitFor();const tour=await p.locator('.rat-tour').boundingBox(),controls=await p.locator('.scene-controls').boundingBox();
 assert(tour.height<80,'Tour must not cover canvas');assert(tour.y+tour.height<controls.y,'Tour overlaps controls');
 assert(tour.x>=0&&tour.x+tour.width<=width);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert(await p.evaluate(()=>document.elementFromPoint(innerWidth/2,innerHeight*.45)?.tagName==='CANVAS'),'Tour intercepts canvas');
 await p.getByRole('button',{name:'Next rat',exact:true}).click();await p.waitForTimeout(1800);
 await p.screenshot({path:path.join(out,'rat-tour-mobile-'+width+'.png')});
 mobile.push({width,height,tour,controls});
 await p.locator('.dock-tab.is-colony').click();assert(!await p.locator('.rat-tour').isVisible());
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'rat-tour-gpu-results.json'),JSON.stringify({gpu,flights,mobile,errors},null,2));console.log(JSON.stringify({gpu,flights,mobile}));await ctx.close();
 for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
 const rec=await b.newContext({viewport:{width,height},recordVideo:{dir:out,size:{width,height}}}),v=await rec.newPage();await v.addInitScript(()=>localStorage.setItem('rattery:welcome-explainer:v2','done'));await v.goto(base);await v.waitForSelector('.burrow-host[data-rats="blender"]');
 for(let i=0;i<4;i++){await v.getByRole('button',{name:'Next rat',exact:true}).click();await v.waitForTimeout(2400);}
 await v.emulateMedia({reducedMotion:'reduce'});await v.getByRole('button',{name:'Previous rat',exact:true}).click();await v.waitForTimeout(1500);
 const video=v.video();await rec.close();await video.saveAs(path.join(out,'rat-tour-'+label+'-rtx4060ti.webm'));
 }
 console.log('PASS flight pacing, manual cancellation, reduced motion, keyboard input guards and mobile cinema');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
