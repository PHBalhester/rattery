const {chromium}=require('./lib/browser-runtime.cjs');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});
try{const page=await browser.newPage({viewport:{width:1100,height:820}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:5173/?view=rat-studio');await page.waitForSelector('#rat-studio[data-ready="true"]');
const metadata=await page.locator('#rat-studio').evaluate(e=>({...e.dataset}));assert.equal(metadata.meshes,'7');assert.equal(metadata.bones,'17');assert.equal(metadata.clips,'Idle,Sniff,Walk');
for(const clip of ['Sniff','Walk','Idle']){await page.locator(`[data-clip="${clip}"]`).click();await page.waitForTimeout(400);assert.equal(await page.locator('#rat-studio').getAttribute('data-animation'),clip);}
const rigCheck=await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js');
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const gltf=await new GLTFLoader().loadAsync('/models/rat-anatomy.glb');
  const mixer=new T.AnimationMixer(gltf.scene);let samples=0;
  for(const clip of gltf.animations){mixer.stopAllAction();mixer.clipAction(clip).play();
    for(let frame=0;frame<=30;frame++){mixer.setTime(clip.duration*frame/30);gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();const p=o.geometry.attributes.position;
        for(let i=0;i<p.count;i+=53){const v=new T.Vector3().fromBufferAttribute(p,i);o.applyBoneTransform(i,v);
          if(![v.x,v.y,v.z].every(Number.isFinite)||v.length()>5)throw Error('Invalid skinned vertex');samples++;}
      });
    }
  }return {samples,clips:gltf.animations.length};
});assert.ok(rigCheck.samples>1000);
await page.locator('#studio-pause').click();assert.equal(await page.locator('#studio-pause').textContent(),'Continuar');
await page.screenshot({path:require('node:path').join(require('./lib/browser-runtime.cjs').outputDir,'rat-blender-browser.png')});
await page.locator('#studio-pause').click();await page.locator('#studio-front').click();await page.locator('[data-clip="Walk"]').click();
for(let i=0;i<3;i++){await page.waitForTimeout(220);await page.screenshot({path:require('node:path').join(require('./lib/browser-runtime.cjs').outputDir,`rat-walk-front-${i}.png`)});}
await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);console.log(JSON.stringify({metadata,rigCheck,errors,mobileOverflow:false}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
