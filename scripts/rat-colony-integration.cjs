const {chromium}=require('./lib/browser-runtime.cjs');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true});try{const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/Shader Error|VALIDATE_STATUS|GL_INVALID/.test(m.text()))errors.push(m.text());});await p.goto('http://localhost:5173/');await p.waitForSelector('.burrow-host[data-rats="blender"][data-habitat="blender"]');
const result=await p.evaluate(async()=>{
 const {BlenderRatAssets}=await import('/src/render/BlenderRat.ts');const a=await BlenderRatAssets.load(),one=a.create('F1'),two=a.create('F2');
 const meshes=v=>{const out=[];v.root.traverse(o=>{if(o.isSkinnedMesh)out.push(o)});return out;};
 const m1=meshes(one),m2=meshes(two);if(new Set(m1.map(m=>m.skeleton)).size!==1)throw Error('Skeleton duplicated per mesh');if(m1[0].skeleton.bones[0]===m2[0].skeleton.bones[0])throw Error('Rats share animated bones');
 const lods=[];
 for(const distance of [4,18,60]){one.update(.016,distance,true,.7,false,false,true,false,false);one.root.updateMatrixWorld(true);
  const features=m1.filter(m=>/eyes|pink/i.test(m.name));if(!features.every(m=>m.visible&&m.geometry.attributes.position.count>0))throw Error('Missing face');
  for(let step=0;step<60;step++){one.update(1/30,distance,true,.7,false,false,true,false,false);one.root.updateMatrixWorld(true);for(const m of m1){m.skeleton.update();if(!Array.from(m.skeleton.boneMatrices).every(Number.isFinite))throw Error('Invalid bone matrix');}}
  lods.push({distance,level:one.root.userData.lod,triangles:m1.reduce((s,m)=>s+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0),meshes:m1.length});
 }
 if(!(lods[0].triangles>lods[1].triangles&&lods[1].triangles>lods[2].triangles))throw Error('LOD not reducing geometry');
 let maxTurn=0;const bones=m1[0].skeleton.bones;let previous=bones.map(b=>b.quaternion.clone());
 for(let i=0;i<180;i++){const moving=i<60||i>=120;one.update(1/60,4,moving,moving?.6:0,false,false,true,false,false);for(let j=0;j<bones.length;j++){maxTurn=Math.max(maxTurn,previous[j].angleTo(bones[j].quaternion));previous[j].copy(bones[j].quaternion);}}
 if(maxTurn>.15)throw Error('Abrupt animation transition '+maxTurn);
 one.update(.016,4,false,0,true,true,false,false,false);const eyes=m1.find(m=>m.name==='Ruby_black_eyes');if(!eyes||eyes.visible)throw Error('Newborn eyes open');
 one.update(.016,4,false,0,false,false,true,true,true);if(!eyes.visible)throw Error('Eyes did not reopen');one.dispose();two.dispose();a.dispose();return {lods,independentSkeletons:true,maxTurn};
});
await p.route('**/models/rat-gait-far.glb',r=>r.abort());await p.reload();await p.waitForSelector('.burrow-host[data-rats="fallback"][data-habitat="blender"]');assert.deepEqual(errors,[]);console.log(JSON.stringify({...result,fallback:true,errors}));}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
