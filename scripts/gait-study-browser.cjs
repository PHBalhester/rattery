const {chromium}=require('./lib/browser-runtime.cjs');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5173/?view=gait-studio');await page.locator('#rat-studio[data-ready=true]').waitFor();
 const results=await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js');const {GLTFLoader}=await import('/node_modules/.vite/deps/three_addons_loaders_GLTFLoader__js.js');
  const {StudyFootMotor}=await import('/src/render/StudyFootMotor.ts');const {StudyBodyMotion}=await import('/src/render/StudyBodyMotion.ts');const results=[];
  for(const fps of [30,60,120])for(const speed of [.15,.35,.7]){
   const {scene:model}=await new GLTFLoader().loadAsync('/models/rat-gait-study.glb');new T.Group().add(model);const bones=new Map();model.traverse(o=>{if(o.isBone)bones.set(o.name,o);});
   const body=new StudyBodyMotion(bones),feet=new StudyFootMotor(model,bones);model.position.y=-.02;
   let error=0,airborne=0;const support=[0,0,0,0],steps=[0,0,0,0];let previous;let tailMotion=0;const tail=bones.get('caudal5'),rest=tail.quaternion.clone();
   for(let frame=0;frame<fps*8;frame++){
    const velocity=frame<fps*6?speed:0;body.update(1/fps,velocity,feet.diagnostics());feet.update(1/fps,()=>0,false,frame===0,velocity);
    const ds=feet.diagnostics();tailMotion=Math.max(tailMotion,rest.angleTo(tail.quaternion));
    for(let j=0;j<4;j++){const f=ds[j];error=Math.max(error,Math.hypot(...f.actual.map((v,k)=>v-f.target[k])));if(frame>=fps&&frame<fps*6){if(!f.swing)support[j]++;if(previous&&!previous[j].swing&&f.swing)steps[j]++;}}
    airborne=Math.max(airborne,ds.filter(f=>f.swing).length);previous=ds;
   }
   results.push({fps,speed,error,airborne,tailMotion,support:support.map(n=>n/(fps*5)),steps,stopped:feet.diagnostics().every(f=>!f.swing)});
  }return results;
 });console.log(JSON.stringify(results));for(const r of results){assert(r.error<.03,JSON.stringify(r));assert(r.airborne<=2);assert(r.tailMotion>.005);assert(r.stopped);assert(r.steps.every(n=>n>1));assert(r.support.every(n=>n>.45&&n<.85));}
 await page.getByRole('button',{name:'Repouso',exact:true}).click();assert.equal(await page.locator('#rat-studio').getAttribute('data-animation'),'Idle');await page.getByRole('button',{name:'Farejar',exact:true}).click();await page.getByRole('button',{name:'Caminhada',exact:true}).click();assert.deepEqual(errors,[]);
 console.log('PASS gait study rig, nine speed/FPS cases, support, stop, tail and controls');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
