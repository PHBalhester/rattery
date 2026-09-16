const {chromium}=require('./lib/browser-runtime.cjs');const fs=require('node:fs');
(async()=>{
 const results=[];
 for(const software of [false]){
  const args=software?['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']:['--enable-webgl'];
  const b=await chromium.launch({headless:true,args});const p=await b.newPage({viewport:{width:1280,height:720}});let storeUrl='';const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(new URL(r.url()).pathname==='/src/store.ts')storeUrl=r.url()});
  await p.addInitScript(()=>{window.__drawCalls=0;for(const C of [WebGLRenderingContext,WebGL2RenderingContext])for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const original=C.prototype[name];if(!original)continue;C.prototype[name]=function(...args){window.__drawCalls++;return original.apply(this,args)}}});
  await p.route('**/api/**',r=>r.fulfill({json:{ok:true,launched:false,chainId:4663,block:0,links:{site:'',x:'',pons:'',explorer:''},updated:0}}));
  await p.goto('http://localhost:4173/scripts/audit-production.html',{waitUntil:'networkidle'});await p.locator('.burrow-host canvas').waitFor();
  await p.evaluate(async url=>{window.__sim=window.__audit;window.__base=structuredClone(window.__sim.getWorld().rats);const marketBus=window.__market;let n=0;setInterval(()=>marketBus.emit({id:'QA-perf-'+n,ts:Date.now(),side:n++%2?'buy':'sell',usd:8000,eth:8000/2400,tokens:1,trader:'QA-load',isNewHolder:false,venue:'demo'}),20)},storeUrl);
  for(const population of [4,80]){
   await p.evaluate(n=>{const w=window.__sim.getWorld();w.rats=structuredClone(window.__base);const r=Object.values(w.rats);for(let i=4;i<n;i++){const a=structuredClone(r[i%4]);a.id='bench-'+i;a.x=600+(i%10)*25;a.y=350+Math.floor(i/10)*25;w.rats[a.id]=a;}window.__sim.useStore.setState(s=>({version:s.version+1}));},population);
   await p.waitForTimeout(3000);
   const sample=await p.evaluate(()=>new Promise(resolve=>{let frames=0,last=performance.now();const intervals=[];const start=performance.now(),before=window.__drawCalls;const gl=document.querySelector('.burrow-host canvas').getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');function frame(){const now=performance.now();intervals.push(now-last);last=now;frames++;if(performance.now()-start>=8000)resolve({frames,ms:performance.now()-start,drawCalls:window.__drawCalls-before,p95ms:intervals.sort((a,b)=>a-b)[Math.floor(intervals.length*.95)],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)});else requestAnimationFrame(frame)}requestAnimationFrame(frame)}));
   results.push({softwareRequested:software,population,...sample,fps:sample.frames/(sample.ms/1000)});
  }
  if(errors.length)throw Error(JSON.stringify(errors));await b.close();
 }
 fs.writeFileSync(__dirname+'/../test-results/audit-2026-09-16/production-performance.json',JSON.stringify({scope:'1280x720, active simulation and requested 50 synthetic trades/s, overview camera; default renderer.',results},null,2));console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exit(1)});

