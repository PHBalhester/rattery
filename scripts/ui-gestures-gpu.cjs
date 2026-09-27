const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../test-results/browser');fs.mkdirSync(out,{recursive:true});
const base=process.env.RATTERY_BASE_URL||'http://localhost:5176/';
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11']});try{
const c=await b.newContext({viewport:{width:1440,height:900}}),p=await c.newPage(),errors=[];
p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>localStorage.setItem('rattery:welcome-explainer:v2','done'));
await p.goto(base);await p.waitForSelector('.burrow-host[data-rats="blender"]');
const gpu=await p.evaluate(()=>{const g=document.createElement('canvas').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return g.getParameter(e.UNMASKED_RENDERER_WEBGL)});
assert(!/SwiftShader|llvmpipe/i.test(gpu));
const results={gpu,browser:b.version(),samples:[]};
async function sample(name){await p.waitForTimeout(3000);const stats=await p.evaluate(()=>new Promise(resolve=>{let start,last;const d=[];function f(t){if(start===undefined){start=last=t;requestAnimationFrame(f);return;}d.push(t-last);last=t;if(t-start<10000)return requestAnimationFrame(f);d.sort((a,b)=>a-b);resolve({fps:d.length*1000/(t-start),p95Ms:d[Math.floor(d.length*.95)],telemetry:JSON.parse(document.querySelector('.burrow-host').dataset.performance)});}requestAnimationFrame(f)}));results.samples.push({name,...stats});console.log(name,JSON.stringify(stats));}
await sample('desktop-overview');await p.getByRole('button',{name:'Follow a rat',exact:true}).click();await sample('desktop-follow-resident');
await p.screenshot({path:path.join(out,'ui-gestures-follow.png')});
await p.emulateMedia({reducedMotion:'reduce'});await sample('desktop-reduced-motion');
await p.evaluate(async()=>{const React=await import('/node_modules/.vite/deps/react.js'),DOM=await import('/node_modules/.vite/deps/react-dom_client.js'),{default:Count}=await import('/src/render/Count.tsx');const el=document.createElement('div');el.id='counter-test';document.body.append(el);const root=(DOM.createRoot||DOM.default.createRoot)(el);window.renderCounter=v=>root.render((React.createElement||React.default.createElement)(Count,{value:v}));window.renderCounter(0)});
await p.waitForFunction(()=>document.querySelector('#counter-test')?.textContent==='0');
await p.emulateMedia({reducedMotion:'no-preference'});await p.evaluate(()=>window.renderCounter(1000000));await p.waitForTimeout(60);
await p.emulateMedia({reducedMotion:'reduce'});await p.waitForFunction(()=>document.querySelector('#counter-test').textContent==='1000000');
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'ui-gpu-results.json'),JSON.stringify(results,null,2));await c.close();
const rec=await b.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}}),v=await rec.newPage();
await v.addInitScript(()=>localStorage.setItem('rattery:welcome-explainer:v2','done'));await v.goto(base);await v.waitForSelector('.burrow-host[data-rats="blender"]');
await v.getByRole('button',{name:'Follow a rat',exact:true}).click();await v.waitForTimeout(26000);await v.emulateMedia({reducedMotion:'reduce'});await v.waitForTimeout(3000);
const video=v.video();await rec.close();await video.saveAs(path.join(out,'ui-resident-gestures-rtx4060ti.webm'));console.log('PASS GPU, counter preference change and resident recording');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
