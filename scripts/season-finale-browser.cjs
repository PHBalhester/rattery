const {chromium}=require('playwright');const assert=require('node:assert/strict');
const CLOSE=1791169200000,base=process.env.TEST_URL||'http://localhost:5176';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=d3d11']});try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('rattery:welcome-explainer:v2','done'));
  let phase='open',serverAt=CLOSE-30000,reason=null;
  const rows=[{nest:3,ticker:'AMZN',baseHalves:'5000',weeklyAdjustment:'15',finalHalves:'5030',gross:'1000'},{nest:1,ticker:'NVDA',baseHalves:'3000',weeklyAdjustment:'-20',finalHalves:'2960',gross:'500'},{nest:2,ticker:'AAPL',baseHalves:'2000',weeklyAdjustment:'0',finalHalves:'2000',gross:'100'}];
  await page.route('**/api/season-result',r=>r.fulfill({json:{protocol:1,season:'RATTERY-SEASON-1-2026-09-28',phase,serverAt,closesAt:CLOSE,winner:phase==='complete'?'AMZN':null,reason,ranking:phase==='complete'?rows:[],resultId:'0x'+'1'.repeat(64),block:81000000,blockHash:'0x'+'2'.repeat(64),confirmedCheckpoints:phase==='open'?929:930,requiredCheckpoints:930}}));
  await page.route('**/api/payment?op=season/overview',r=>r.fulfill({json:{protocol:1,phase:'open',serverAt,opensAt:1790611200000,closesAt:CLOSE,config:{chainId:4663,router:'0x2374a8a715f5ca87ae43609c9bdc74691d5b7b57',quoteSigner:'0xb476efac1611d4e3bc5a01121a15b44676ae496e'},member:null,nests:[1,2,3].map(id=>({id,score:'500',halfPoint:0,shieldUntil:0})),events:{available:true,items:[]}}}));
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__seasonScene,null,{timeout:60000});
  if(width<600)await page.locator('.dock-tab.is-season').click();
  const actions=page.locator('.season-gameplay-action:visible');await actions.first().waitFor({timeout:30000});await page.waitForFunction(()=>document.querySelector('.season-gameplay-action').disabled===false);
  await page.waitForFunction(async()=>{const m=await import('/src/season/resultState.ts');return m.useSeasonResult.getState().available});serverAt=CLOSE-1000;await page.evaluate(async()=>{await(await import('/src/season/resultState.ts')).refreshSeasonResult()});
  await page.waitForFunction(()=>document.querySelector('.season-gameplay-action').disabled===true,null,{timeout:10000}).catch(async e=>{console.log(await page.evaluate(async()=>{const m=await import('/src/season/resultState.ts');return {now:Date.now(),state:m.useSeasonResult.getState()}}));throw e;});
  serverAt=CLOSE+1000;phase='awaiting';reason='official-closing-prices';
  await page.evaluate(async()=>{await(await import('/src/season/resultState.ts')).refreshSeasonResult()});
  await page.getByText('Result being verified',{exact:true}).filter({visible:true}).waitFor();assert(await actions.first().isDisabled());assert.equal(await page.evaluate(()=>window.__seasonStore.getState().winner),null);
  if(width===390)await page.emulateMedia({reducedMotion:'reduce'});
  phase='complete';await page.evaluate(async()=>{await(await import('/src/season/resultState.ts')).refreshSeasonResult()});
  if(width===1440)await page.waitForFunction(()=>window.__seasonScene.diagnostics().particles>0,null,{timeout:10000});
  await page.getByRole('dialog',{name:'AMZN'}).waitFor();await page.waitForFunction(()=>window.__seasonScene.diagnostics().winner==='AMZN');
  assert.equal(await page.evaluate(()=>window.__seasonStore.getState().scores.AMZN),2515);
  assert.equal(await page.evaluate(()=>window.__seasonScene.diagnostics().nests.find(n=>n.id==='AMZN').crown),true);
  if(width===390)assert.equal(await page.evaluate(()=>window.__seasonScene.diagnostics().particles),0);
  const serial=await page.evaluate(()=>window.__seasonStore.getState().reveal);
  await page.evaluate(async()=>{await(await import('/src/seasonState.ts')).refreshSeason();await(await import('/src/season/resultState.ts')).refreshSeasonResult()});
  assert.equal(await page.evaluate(()=>window.__seasonStore.getState().scores.AMZN),2515);assert.equal(await page.evaluate(()=>window.__seasonStore.getState().reveal),serial);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:process.env.ARTIFACT_DIR+'/season-finale-'+width+'.png'});
  await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'AMZN'}).waitFor({state:'hidden'});
  await page.evaluate(async()=>{await(await import('/src/season/resultState.ts')).refreshSeasonResult()});assert.equal(await page.getByRole('dialog',{name:'AMZN'}).count(),0);
  await page.getByRole('button',{name:'View final result',exact:true}).filter({visible:true}).click();await page.getByRole('dialog',{name:'AMZN'}).waitFor();await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(1000);
  const gpu=await page.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL)});assert(!/SwiftShader|llvmpipe|software/i.test(gpu));assert.deepEqual(errors,[]);
  console.log('PASS',width,'close, no premature winner, crown, final scores, one reveal, reopen, reduced motion, no overflow/errors; GPU',gpu);await page.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
