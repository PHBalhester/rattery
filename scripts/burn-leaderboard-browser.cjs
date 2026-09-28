// Top-burner leaderboard UI: hidden until toggled, real API data rendered with exact shares,
// nest column empty before Season I, Escape closes and returns focus, locked on the default page.
// Run against the dev server: RATTERY_TEST_URL=http://127.0.0.1:5173/ node scripts/burn-leaderboard-browser.cjs
const {chromium}=require('./lib/browser-runtime.cjs');
const assert=require('node:assert/strict');
(async()=>{
 const base=process.env.RATTERY_TEST_URL||'http://localhost:5173/',E=10n**18n,u=n=>(BigInt(n)*E).toString();
 const board={protocol:1,kind:'burners',chainId:4663,at:Date.now(),totalUnits:u(2000000),burns:9,wallets:3,firstBlock:1,lastBlock:9,
  leaders:[{wallet:'0x'+'a'.repeat(40),units:u(1000000),burns:2,nest:null},{wallet:'0x'+'b'.repeat(40),units:u(500000),burns:6,nest:null},{wallet:'0x'+'c'.repeat(40),units:u(1),burns:1,nest:null}]};
 const browser=await chromium.launch({headless:true});
 try{
  for(const [width,height] of [[1440,900],[390,844]]){
   const p=await browser.newPage({viewport:{width,height}});p.setDefaultTimeout(Number(process.env.RATTERY_TIMEOUT||30000));const errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(()=>{try{localStorage.setItem('rattery:welcome-explainer:v2','done');localStorage.setItem('rattery:panels','open');}catch{}});
   // Locked on the default page before release
   await p.goto(base);await p.locator('.wallet-trigger').waitFor();
   assert.equal(await p.locator('.season-board-toggle,.burn-nav-toggle').count(),0,'Leaderboard toggle must not appear on the default page');
   await p.route('**/api/burners',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(board)}));
   await p.goto(base+'?burners');
   const toggle=p.locator(width<780?'.burn-nav-toggle':'.season-board-toggle');await toggle.waitFor();
   assert.equal(await p.locator('.burn-board').count(),0,'Hidden until toggled');
   assert.equal(await toggle.getAttribute('aria-expanded'),'false');
   await toggle.click();await p.locator('.burn-row[data-rank="3"]').waitFor();
   assert.equal(await toggle.getAttribute('aria-expanded'),'true');
   assert.deepEqual((await p.locator('.burn-share').allTextContents()).map(s=>s.trim()),['50.00%','25.00%','<0.01%']);
   assert.deepEqual((await p.locator('.burn-who a').allTextContents()),['0xaaaa…aaaa','0xbbbb…bbbb','0xcccc…cccc']);
   assert.equal(await p.locator('.burn-nest.is-none').count(),3,'No nests before Season I');
   assert.equal(await p.locator('.burn-board .swin-badge.is-demo').count(),0,'Real data is not labelled DEMO');
   assert.equal(await p.locator('.burn-who a').first().getAttribute('rel'),'noopener noreferrer');
   const box=await p.locator('.burn-board').boundingBox();assert(box&&box.x>=0&&box.x+box.width<=width+1,'Panel inside viewport');
   await p.keyboard.press('Escape');await p.locator('.burn-board').waitFor({state:'detached'});
   assert.equal(await p.evaluate(()=>document.activeElement?.classList.contains('season-board-toggle')||document.activeElement?.classList.contains('burn-nav-toggle')),true,'Focus returns to the toggle');
   assert.deepEqual(errors,[]);console.log('PASS burn leaderboard',width,height);await p.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
