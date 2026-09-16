const {chromium}=require('./lib/browser-runtime.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const outputDir=root+'/test-results';
const read=name=>JSON.parse(fs.readFileSync(root+'/test-results/'+name,'utf8').replace(/^\uFEFF/,''));
(async()=>{
 const data={biscotti:read('mainnet-biscotti-browser-data.json'),zzz:read('mainnet-zzz-browser-data.json')};
 const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let mode='biscotti',failOnce=true,liveOutage=false,liveRows=[],storeUrl='',calls=0;
 const shifts={biscotti:Date.now()-30000-data.biscotti.t0,zzz:Date.now()-30000-data.zzz.t0};
 page.on('request',r=>{if(new URL(r.url()).pathname==='/src/store.ts')storeUrl=r.url()});
 await page.route('**/api/**',async route=>{
  const u=new URL(route.request().url()),d=data[mode];calls++;
  if(u.pathname==='/api/chain')return route.fulfill({json:{ok:true,launched:true,chainId:4663,block:d.birthBlock+d.chunks.length*100-1,token:{address:d.token,name:mode.toUpperCase(),symbol:mode.toUpperCase(),decimals:18,supply:1e9,holders:null},launch:{curve:'0x0000000000000000000000000000000000000000',pairToken:'0x0000000000000000000000000000000000000000',poolId:d.poolId,phase:'graduated',progress:1,quoteRaised:null,graduationThreshold:4.2},feed:{birthBlock:d.birthBlock,chunkBlocks:100,headChunk:d.chunks.length-1},links:{site:'',x:'',pons:'',explorer:'https://robinhoodchain.blockscout.com'},updated:Math.floor(Date.now()/1000)}});
  const n=Number(u.searchParams.get('chunk'));
  if(failOnce&&mode==='biscotti'&&n===1){failOnce=false;return route.fulfill({status:503,body:'QA injected missing chunk'});}
  if(liveOutage)return route.fulfill({status:429,body:'QA injected rate limit'});
  const chunk=d.chunks[n];return route.fulfill({json:chunk?{...chunk,trades:chunk.trades.map(t=>({...t,ts:t.ts+shifts[mode]}))}:{ok:true,launched:true,chunk:n,complete:false,trades:liveRows}});
 });
 await page.goto('http://localhost:5173/',{waitUntil:'networkidle'});
 await page.getByText('Disconnected',{exact:true}).waitFor({timeout:15000});
 await page.getByText('Live',{exact:true}).waitFor({timeout:45000});
 await page.evaluate(async url=>{window.__qaStore=await import(url)},storeUrl);
 const state=()=>page.evaluate(url=>{const m=window.__qaStore,s=m.useStore.getState(),w=m.getWorld();return {status:s.feedStatus,token:s.chain?.token?.address,ids:s.trades.map(t=>t.id),day:w.simDay,alive:Object.values(w.rats).filter(r=>r.deadAt===null).length,stress:w.env.stress,panic:w.env.panic,canvas:!!document.querySelector('.burrow-host canvas')};},storeUrl);
 let s=await state();assert.equal(s.token,data.biscotti.token);assert.equal(s.ids.length,30);assert.equal(new Set(s.ids).size,30);assert(s.canvas&&s.day>0);
 const last=data.biscotti.chunks.flatMap(c=>c.trades).at(-1);assert.equal(s.ids[0],last.id);
 await page.waitForFunction(()=>Date.now()>=(window.__qaStore.getWorld().env.nextTradeReactionAt??0),null,{timeout:20000});
 const beforeStress=s.stress;liveRows=[{...last,id:'QA-SYNTHETIC-GIANT-SELL',block:last.block+1000,logIndex:1,side:'sell',eth:100,ts:Date.now()}];
 await page.waitForFunction(url=>window.__qaStore.useStore.getState().trades.some(t=>t.id==='QA-SYNTHETIC-GIANT-SELL'),storeUrl,{timeout:10000});
 await page.waitForFunction(url=>window.__qaStore.getWorld().env.panic>.25,storeUrl,{timeout:5000});s=await state();assert(Number.isFinite(s.stress)&&s.stress>=0&&s.stress<=1&&s.panic>.25,JSON.stringify({beforeStress,s}));
 liveOutage=true;await page.getByText('Disconnected',{exact:true}).waitFor({timeout:10000});liveOutage=false;
 await page.getByText('Live',{exact:true}).waitFor({timeout:20000});s=await state();assert.equal(s.ids.filter(id=>id==='QA-SYNTHETIC-GIANT-SELL').length,1);
 await page.evaluate(()=>{const el=document.createElement('div');el.textContent='QA · captured BISCOTTI sample · timestamps shifted · synthetic stress';Object.assign(el.style,{position:'fixed',bottom:'4px',left:'4px',zIndex:'99999',background:'#111',color:'#fff',padding:'5px',fontSize:'11px'});document.body.append(el)});
 for(const name of ['Zoom in','Zoom out','Nest','Play areas','Overview'])await page.getByRole('button',{name,exact:true}).click();
 await page.getByRole('button',{name:'Hide panels',exact:true}).click();await page.locator('.condition-panel').waitFor({state:'hidden'});await page.getByRole('button',{name:'Show panels',exact:true}).click();await page.locator('.condition-panel').waitFor({state:'visible'});
 await page.screenshot({path:outputDir+'/biscotti-desktop.png'});
 for(const [width,height] of [[390,844],[320,568],[844,390],[1920,1080]]){await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:outputDir+'/biscotti-mobile.png'});
 mode='zzz';liveRows=[];
 await page.waitForFunction(({url,token})=>{const m=window.__qaStore,s=m.useStore.getState();return s.chain?.token?.address===token&&s.feedStatus==='live'}, {url:storeUrl,token:data.zzz.token},{timeout:40000});
 await page.waitForFunction(({url,id})=>window.__qaStore.useStore.getState().trades[0]?.id===id,{url:storeUrl,id:data.zzz.chunks.flatMap(c=>c.trades).at(-1).id},{timeout:15000});s=await state();assert.equal(s.ids[0],data.zzz.chunks.flatMap(c=>c.trades).at(-1).id);assert(!s.ids.includes('QA-SYNTHETIC-GIANT-SELL'));
 await page.setViewportSize({width:1440,height:900});await page.reload({waitUntil:'networkidle'});await page.evaluate(async url=>{window.__qaStore=await import(url)},storeUrl);await page.getByText('Live',{exact:true}).waitFor({timeout:15000});s=await state();assert.equal(s.token,data.zzz.token);
 const callsBeforeResume=calls;
 await page.evaluate(()=>{window.__qaHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__qaHidden});document.dispatchEvent(new Event('visibilitychange'))});
 await page.waitForTimeout(2200);
 await page.evaluate(()=>{window.__qaHidden=false;document.dispatchEvent(new Event('visibilitychange'))});
 await page.waitForFunction(()=>window.__qaStore.useStore.getState().feedStatus==='live',null,{timeout:20000});assert(calls>callsBeforeResume,'Returning to foreground must refresh canonical feed');
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(async url=>{const m=await import(url),w=m.getWorld(),r=Object.values(w.rats);for(let i=4;i<80;i++){const clone=structuredClone(r[i%4]);clone.id='QA-load-'+i;w.rats[clone.id]=clone;}w.nextId=81},storeUrl);
 const frames=await page.evaluate(()=>new Promise(resolve=>{let count=0;const start=performance.now();function f(){count++;if(performance.now()-start>=3000)resolve({count,ms:performance.now()-start});else requestAnimationFrame(f)}requestAnimationFrame(f)}));
 s=await state();assert.equal(s.alive,80);assert(frames.count>0);
 shifts.zzz=0;await page.setViewportSize({width:1440,height:900});await page.reload({waitUntil:'networkidle'});await page.evaluate(async url=>{window.__qaStore=await import(url)},storeUrl);await page.getByText('History limit',{exact:true}).waitFor({timeout:10000});s=await state();assert.equal(s.day,0);assert.equal(s.ids.length,0);shifts.zzz=Date.now()-30000-data.zzz.t0;await page.setViewportSize({width:1440,height:900});await page.reload({waitUntil:'networkidle'});await page.evaluate(async url=>{window.__qaStore=await import(url)},storeUrl);await page.getByText('Live',{exact:true}).waitFor({timeout:15000});
 await page.evaluate(()=>document.querySelector('.burrow-host canvas').getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext());
 await page.getByText('3D unavailable. Enable WebGL to view the colony.',{exact:true}).waitFor({timeout:5000});
 assert.deepEqual(errors,[]);
 const report={scope:'Captured mainnet API responses. Timestamps shifted only in QA to avoid claiming complete historical replay. Synthetic giant sell and 80-rat setup.',historyTrades:187,historyLimitGuard:true,missingChunkRecovery:true,rateLimitRecovery:true,noDuplicateLiveTrade:true,tokenSwitch:true,reload:true,backgroundResync:true,viewports:5,webglFallback:true,frames80Rats:frames,errors,calls};
 fs.writeFileSync(outputDir+'/biscotti-browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});





