const {chromium}=require('./lib/browser-runtime.cjs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.route('**/__atmosphere-test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));
  await p.goto('http://localhost:5173/__atmosphere-test');
  const result=await p.evaluate(async()=>{
   const {Atmosphere}=await import('/src/render/Atmosphere.ts');
   const T=await import('/node_modules/.vite/deps/three.js');
   const scene=new T.Scene(),camera=new T.PerspectiveCamera(45,1,.1,100);camera.position.set(0,5,10);camera.lookAt(0,0,0);
   const renderer=new T.WebGLRenderer();renderer.setSize(64,64);document.body.append(renderer.domElement);
   const atmosphere=new Atmosphere(renderer,scene,camera,new T.Vector3());
   const sizes=[],dust=[],passes=atmosphere.composer.passes,disposed=[];
   for(const [level,dpr] of [[0,2],[1,1.25],[2,.9],[3,.65]]){
    atmosphere.setLevel(level);renderer.setPixelRatio(dpr);atmosphere.setSize(64,64);atmosphere.render(.016,false);
    sizes.push(atmosphere.composer.renderTarget1.width);dust.push(atmosphere.dust.visible);
   }
   for(const [i,pass] of passes.entries()){const original=pass.dispose.bind(pass);pass.dispose=()=>{disposed.push(i);original();};}
   let envDisposed=false;atmosphere.env.addEventListener('dispose',()=>envDisposed=true);
   atmosphere.dispose();const clean=scene.environment===null&&scene.background===null&&!scene.getObjectByName('Atmosphere table')&&!scene.getObjectByName('Atmosphere dust');
   renderer.dispose();renderer.forceContextLoss();return {sizes,dust,disposed,passCount:passes.length,envDisposed,clean};
  });
  assert.deepEqual(result.sizes,[128,80,57.6,41.6]);assert.deepEqual(result.dust,[true,true,false,false]);assert.equal(result.disposed.length,result.passCount);assert(result.envDisposed&&result.clean);assert.deepEqual(errors,[]);
  console.log('PASS atmosphere four quality levels, render target resizing, all pass/environment cleanup');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});