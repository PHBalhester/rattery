const {chromium}=require('./lib/browser-runtime.cjs');const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true}),p=await b.newPage({viewport:{width:1000,height:760}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:5173/',{waitUntil:'networkidle'});
await p.evaluate(async()=>{
 const T=await import('/node_modules/.vite/deps/three.js');const {RatAssets,RatModel}=await import('/src/render/RatModel.ts');const {createWorld,NEST_POS}=await import('/src/sim/colony.ts');
 const scene=new T.Scene();scene.background=new T.Color('#e5e1db');const camera=new T.PerspectiveCamera(35,1000/760,.01,100);camera.position.set(2.2,1.5,3.3);camera.lookAt(0,.38,0);
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,760);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
 const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:99999';host.append(renderer.domElement);document.body.append(host);
 scene.add(new T.HemisphereLight(0xffffff,0x827268,1.3));const light=new T.DirectionalLight(0xffffff,2);light.position.set(2,4,3);light.castShadow=true;scene.add(light);
 const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:0xe5e1db,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;floor.receiveShadow=true;scene.add(floor);
 const assets=new RatAssets(),world=createWorld(),r=Object.values(world.rats)[0],model=new RatModel(assets,r.id,true);scene.add(model.root);model.sync(r,1,1/60,0,false,false,camera);model.root.position.set(0,0,0);renderer.render(scene,camera);
 window.referenceQA={meshes:0};model.root.traverse(o=>{if(o.isMesh)window.referenceQA.meshes++});
});
await p.screenshot({path:require('node:path').join(require('./lib/browser-runtime.cjs').outputDir,'rat-reference.png')});assert.deepEqual(errors,[]);console.log(await p.evaluate(()=>window.referenceQA));await b.close();})().catch(e=>{console.error(e);process.exit(1)});
