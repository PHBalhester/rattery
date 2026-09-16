const {chromium}=require('./lib/browser-runtime.cjs');const fs=require('node:fs');
(async()=>{
 const results=[];
 for(const software of [true,false]){
  const args=software?['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']:['--enable-webgl'];
  const b=await chromium.launch({headless:true,args});const p=await b.newPage({viewport:{width:1280,height:720}});let storeUrl='';const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(new URL(r.url()).pathname==='/src/store.ts')storeUrl=r.url()});
  await p.addInitScript(()=>{window.__drawCalls=0;for(const C of [WebGLRenderingContext,WebGL2RenderingContext])for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const original=C.prototype[name];if(!original)continue;C.prototype[name]=function(...args){window.__drawCalls++;return original.apply(this,args)}}});
  await p.route('**/api/**',r=>r.fulfill({json:{ok:true,launched:false,chainId:4663,block:0,links:{site:'',x:'',pons:'',explorer:''},updated:0}}));
  await p.goto('http://localhost:5173/',{waitUntil:'networkidle'});await p.locator('.burrow-host canvas').waitFor();
  await p.evaluate(async url=>{window.__sim=await import(url);window.__sim.stopEngine();window.__base=structuredClone(window.__sim.getWorld().rats)},storeUrl);
  for(const population of [4,80]){
   await p.evaluate(n=>{const w=window.__sim.getWorld();w.rats=structuredClone(window.__base);const r=Object.values(w.rats);for(let i=4;i<n;i++){const a=structuredClone(r[i%4]);a.id='bench-'+i;a.x=600+(i%10)*25;a.y=350+Math.floor(i/10)*25;w.rats[a.id]=a;}window.__sim.useStore.setState(s=>({version:s.version+1}));},population);
   const sample=await p.evaluate(()=>new Promise(resolve=>{let frames=0;const start=performance.now(),before=window.__drawCalls;const gl=document.querySelector('.burrow-host canvas').getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');function frame(){frames++;if(performance.now()-start>=4000)resolve({frames,ms:performance.now()-start,drawCalls:window.__drawCalls-before,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)});else requestAnimationFrame(frame)}requestAnimationFrame(frame)}));
   results.push({softwareRequested:software,population,...sample,fps:sample.frames/(sample.ms/1000)});
  }
  if(errors.length)throw Error(JSON.stringify(errors));await b.close();
 }
 fs.writeFileSync(__dirname+'/render-benchmark.json',JSON.stringify({scope:'1280x720, fixed simulation, overview camera. Software vs default renderer; default is not assumed to be hardware.',results},null,2));console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exit(1)});
