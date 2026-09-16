const {chromium}=require('./lib/browser-runtime.cjs');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true});try{const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:5173/');await p.waitForSelector('.burrow-host[data-rats="blender"]');const result=await p.evaluate(async()=>{
 const {BlenderRatAssets}=await import('/src/render/BlenderRat.ts');const assets=await BlenderRatAssets.load();const states=new Set();let error=0,blink=0,maxDelta=0;let previous;const rat=assets.create('F1');
 for(let f=0;f<60*85;f++){
  rat.update(1/60,f%3===0?30:4,false,0,false,f===0,true,false,false,()=>0);
  const pose=rat.naturalDiagnostics();states.add(pose.state);blink=Math.max(blink,pose.blink);
  if(previous)maxDelta=Math.max(maxDelta,...['yaw','pitch','sit','lie'].map(k=>Math.abs(pose[k]-previous[k])));previous=pose;
  for(const foot of rat.diagnostics())error=Math.max(error,Math.hypot(...foot.actual.map((v,k)=>v-foot.target[k])));
 }
 for(let f=0;f<120;f++){rat.root.position.x+=.4/60;rat.update(1/60,4,true,.4,false,false,true,false,false,()=>0);}
 const walking=rat.naturalDiagnostics();rat.update(1/60,4,false,0,true,true,true,false,false,()=>0);const reduced=rat.naturalDiagnostics();rat.dispose();assets.dispose();return {states:[...states],error,blink,maxDelta,walking,reduced};
 });console.log(result);assert.deepEqual(new Set(result.states),new Set(['alert','look','sniff','sit','lie']));assert(result.blink>.95);assert(result.maxDelta<.06);assert(result.error<.03);assert(result.walking.sit<.001&&result.walking.lie<.001);assert(result.reduced.blink===0&&result.reduced.yaw===0);assert.deepEqual(errors,[]);}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
