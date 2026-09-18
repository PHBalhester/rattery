const {chromium,firefox,webkit,outputDir}=require('./lib/browser-runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const results=[];
for(const [name,type] of [['chromium',chromium],['firefox',firefox],['webkit',webkit]]){
 if(process.env.RATTERY_BROWSERS&&!process.env.RATTERY_BROWSERS.split(',').includes(name))continue;
 let b;
 try{
 b=await type.launch({headless:true,timeout:30000});
 const context=await b.newContext({viewport:{width:1280,height:720}}),p=await context.newPage(),errors=[],origins=new Set();
 await context.addInitScript(()=>localStorage.setItem('rattery:welcome-tour:v1','done'));
 p.setDefaultTimeout(15000);p.setDefaultNavigationTimeout(20000);
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>origins.add(new URL(r.url()).origin));
 await p.goto(process.env.RATTERY_TEST_URL||'http://localhost:5173/',{waitUntil:'domcontentloaded'});
 await p.locator('.wallet-trigger').waitFor({timeout:30000});
 await p.waitForTimeout(2000);
 const rendering=await p.evaluate(()=>({canvas:!!document.querySelector('canvas'),ratMode:document.querySelector('.burrow-host')?.getAttribute('data-rats')}));
 await p.locator('.wallet-trigger').click();await p.getByRole('heading',{name:'Connect your wallet'}).waitFor();await p.keyboard.press('Escape');
 await p.getByRole('button',{name:'Language / 语言'}).click();assert.equal(await p.locator('html').getAttribute('lang'),'zh-Hans');
 await p.getByRole('button',{name:'Language / 语言'}).click();
 await p.getByRole('button',{name:'Hide panels',exact:true}).click();await p.getByRole('button',{name:'Show panels',exact:true}).click();
 for(const [width,height] of [[390,844],[844,390],[320,640]]){
  await p.setViewportSize({width,height});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await context.setOffline(true);await p.waitForTimeout(1000);await context.setOffline(false);
 await p.reload({waitUntil:'domcontentloaded'});await p.locator('.wallet-trigger').waitFor();
 await p.screenshot({path:path.join(outputDir,'release-'+name+'.png')});
 const timing=await p.evaluate(()=>new Promise(resolve=>{let times=[],last=performance.now();setTimeout(()=>resolve({timeout:true,frames:times.length}),15000);function frame(t){times.push(t-last);last=t;if(times.length<180)requestAnimationFrame(frame);else{times=times.slice(1).sort((a,b)=>a-b);resolve({frames:times.length,p95FrameMs:times[Math.floor(times.length*.95)],meanFps:1000/(times.reduce((a,b)=>a+b,0)/times.length)});}}requestAnimationFrame(frame);}));
 results.push({name,passed:errors.length===0&&rendering.ratMode==='blender'&&!timing.timeout,rendering,timing,errors,origins:[...origins]});
 }catch(e){results.push({name,passed:false,error:e.message});}finally{if(b)await b.close();}
 console.log(JSON.stringify(results.at(-1)));
}
fs.writeFileSync(path.join(outputDir,'cross-browser-release'+(process.env.RATTERY_BROWSERS?'-'+process.env.RATTERY_BROWSERS:'')+'.json'),JSON.stringify(results,null,2));
if(results.some(r=>!r.passed))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
