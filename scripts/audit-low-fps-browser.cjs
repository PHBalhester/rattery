const {chromium}=require('./lib/browser-runtime.cjs');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true});try{const p=await b.newPage();await p.goto('http://localhost:5173/');await p.waitForSelector('.burrow-host[data-rats="blender"]');
const results=await p.evaluate(async()=>{const {BlenderRatAssets}=await import('/src/render/BlenderRat.ts');const assets=await BlenderRatAssets.load();const results=[];
for(const fps of [10,15,24,30,60,120])for(const speed of [.15,.4,.7,1,1.3]){
 const rat=assets.create('F1');let spine,chest;rat.root.traverse(o=>{if(o.isBone&&o.name==='pelvis')spine=o;if(o.isBone&&o.name==='chest')chest=o});const spineRest=spine.quaternion.clone(),chestRest=chest.quaternion.clone();let bodyAngle=0,chestAngle=0;let prior;let slip=0,error=0,airborne=0,steps=0;
 for(let frame=0;frame<fps*4;frame++){
  rat.root.position.x=frame/fps*speed;rat.update(1/fps,4,true,speed,false,frame===0,true,false,false,()=>0);
  bodyAngle=Math.max(bodyAngle,spineRest.angleTo(spine.quaternion));chestAngle=Math.max(chestAngle,chestRest.angleTo(chest.quaternion));const feet=rat.diagnostics();airborne=Math.max(airborne,feet.filter(f=>f.swing).length);
  for(let j=0;j<feet.length;j++){const f=feet[j];error=Math.max(error,Math.hypot(...f.actual.map((x,k)=>x-f.target[k])));if(prior&&!f.swing&&!prior[j].swing&&f.contact===prior[j].contact)slip=Math.max(slip,Math.hypot(...f.target.map((x,k)=>x-prior[j].target[k])));if(prior&&f.swing&&!prior[j].swing)steps++;}
  prior=feet;
 }
 results.push({fps,speed,slip,error,airborne,steps,bodyAngle,chestAngle});rat.dispose();
}
for(const scale of [.6,1,1.12]){
 const rat=assets.create('F2');rat.root.scale.setScalar(scale);let error=0;
 for(let f=0;f<240;f++){const t=f/60,angle=t*.35;rat.root.position.set(Math.sin(angle),0,1-Math.cos(angle));rat.root.rotation.y=-angle;rat.update(1/60,4,true,.35,false,f===0,true,false,false,()=>0);for(const foot of rat.diagnostics())error=Math.max(error,Math.hypot(...foot.actual.map((x,k)=>x-foot.target[k])));}
 results.push({scenario:'turn',scale,error});rat.dispose();
}
{
 const rat=assets.create('F3');let error=0;const ground=x=>x*.12;
 for(let f=0;f<240;f++){rat.root.position.x=f/60*.3;rat.root.position.y=ground(rat.root.position.x);rat.update(1/60,4,true,.3,false,f===0,true,false,false,ground);for(const foot of rat.diagnostics())error=Math.max(error,Math.hypot(...foot.actual.map((x,k)=>x-foot.target[k])));}
 results.push({scenario:'ramp',error});rat.dispose();
}
for(const fps of [10,15,24,30,60,120]){const rat=assets.create('F4');let error=0;for(let f=0;f<fps*4;f++){rat.root.rotation.y=f/fps*2.4;rat.update(1/fps,4,false,0,false,f===0,true,false,false,()=>0);for(const foot of rat.diagnostics())error=Math.max(error,Math.hypot(...foot.actual.map((v,k)=>v-foot.target[k])));}results.push({scenario:'pivot',fps,error});rat.dispose();}
assets.dispose();return results;});console.log(JSON.stringify(results));for(const r of results){if(r.scenario){assert(r.error<.025,JSON.stringify(r));continue;}assert(r.bodyAngle>.012&&r.bodyAngle<.08,'Pelvis support motion out of bounds');assert(r.chestAngle>.008&&r.chestAngle<.065,'Chest support motion out of bounds');assert(r.airborne>=1&&r.airborne<=2);assert(r.slip<1e-6);assert(r.steps>5);assert(r.error<.025,JSON.stringify(r));}
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
