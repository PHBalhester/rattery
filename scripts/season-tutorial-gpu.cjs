const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../test-results/browser');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11']});const results=[];
try {for(const [branch,base,query] of [['ui','http://localhost:5176/','?season-tutorial'],['nests','http://localhost:5173/','?season-preview=1&season-tutorial']]){
for(const [width,height,lang] of [[1440,900,'en'],[390,844,'en'],[360,640,'zh']]){
 const ctx=await browser.newContext({viewport:{width,height},isMobile:width<500,hasTouch:width<500,recordVideo:{dir:out,size:{width,height}}}),p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(lang=>{localStorage.setItem('rattery:welcome-explainer:v2','done');localStorage.setItem('rattery-language',lang)},lang);
 await p.goto(base+query);await p.waitForSelector('.stut-card.is-placed');await p.waitForSelector('.burrow-host[data-rats="blender"]');
 if(branch==='nests')await p.waitForFunction(()=>document.querySelector('.burrow-host')?.dataset.seasonPreview);
 const gpu=await p.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL)});assert(!/SwiftShader|llvmpipe/i.test(gpu));
 await p.evaluate(()=>{window.__frames=[];window.__prev=performance.now();window.__stop=false;function tick(t){window.__frames.push(t-window.__prev);window.__prev=t;if(!window.__stop)requestAnimationFrame(tick)}requestAnimationFrame(tick)});
 const steps=[];
 for(let i=0;i<16;i++){
 await p.waitForTimeout(800);
 const layout=await p.evaluate(()=>{const c=document.querySelector('.stut-card'),r=c.getBoundingClientRect(),body=document.querySelector('.stut-content');return {step:document.querySelector('.stut').dataset.step,x:r.x,y:r.y,width:r.width,height:r.height,overflow:body.scrollWidth-body.clientWidth,viewport:[innerWidth,innerHeight]}});
 assert(layout.x>=-1&&layout.y>=-1&&layout.x+layout.width<=width+1&&layout.y+layout.height<=height+1,JSON.stringify(layout));assert(layout.overflow<=2,'Content horizontal overflow '+JSON.stringify(layout));
 if(branch==='nests'&&['feed','shield','attack','winner'].includes(layout.step)){
 const s=await p.evaluate(async()=>{const s=window.__seasonStore.getState();return {focus:s.focus,event:s.event,winner:s.winner}});
 const expected={feed:'NVDA',shield:'AAPL',attack:'AMZN',winner:'NVDA'}[layout.step];assert.equal(s.focus,expected,JSON.stringify({step:layout.step,s}));if(layout.step==='winner')assert.equal(s.winner,expected);else assert.equal(s.event.kind,layout.step);
 }
 if([0,7,13].includes(i))await p.screenshot({path:path.join(out,`tutorial-${branch}-${width}-${i}.png`)});
 steps.push(layout);if(i<15)await p.locator('.stut-next').click();
 }
 const fps=await p.evaluate(()=>{window.__stop=true;const a=window.__frames.slice(2),sorted=[...a].sort((a,b)=>a-b);return {mean:a.length*1000/a.reduce((a,b)=>a+b,0),p95Ms:sorted[Math.floor(sorted.length*.95)]}});
 await p.locator('.stut-next').click();assert.equal(await p.locator('.stut').count(),0);
 if(!await p.locator('.colony-app.cinema').count())await p.locator('.topbar').getByRole('button',{name:lang==='en'?'Hide info':'隐藏信息',exact:true}).click();
 await p.evaluate(()=>document.querySelector('.season-button.is-primary').click());await p.waitForSelector('.stut-card.is-placed');await p.keyboard.press('Escape');
 assert.equal(await p.locator('.colony-app.cinema').count(),1);
 await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>document.querySelector('.season-button.is-primary').click());await p.waitForSelector('.stut-card.is-placed');await p.keyboard.press('ArrowRight');await p.waitForTimeout(100);
 const focusEscapes=[];for(let t=0;t<6;t++){await p.keyboard.press(t<3?'Tab':'Shift+Tab');if(!await p.evaluate(()=>!!document.activeElement.closest('.stut-card')))focusEscapes.push(t)}
 assert.deepEqual(focusEscapes,[],"Focus escaped tutorial");assert.deepEqual(errors,[]);results.push({branch,width,height,lang,gpu,fps,focusEscapes,steps});
 console.log(JSON.stringify({branch,width,lang,fps,focusEscapes}));const video=p.video();await ctx.close();await video.saveAs(path.join(out,`tutorial-${branch}-${width}.webm`));
 fs.writeFileSync(path.join(out,'season-tutorial-gpu-results.json'),JSON.stringify(results,null,2));
}}}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
