// Production-origin UI exercised against local Vite and isolated fake API/wallet.
// Every HTTP request is intercepted. This test cannot submit a real payment.
const {chromium,outputDir}=require('./lib/browser-runtime.cjs');
const assert=require('node:assert/strict');
const path=require('node:path');
const account='0x1111111111111111111111111111111111111111';
const token='0xc322305e79337300b59ff48389f8c9a1d9e0de76';
const hash='0x'+'a'.repeat(64);
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  await context.routeWebSocket(/.*/,ws=>ws.close());
  const p=await context.newPage();p.setDefaultTimeout(15000);
  let rats=[],intents=[],revision=0;const calls=[],errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.origin!=='https://rattery.tech')return route.abort();
   if(u.pathname==='/api/payment'){
    const op=u.searchParams.get('op');calls.push(op);const data=req.postDataJSON()||{};
    let result={};
    if(op==='auth/challenge')return route.fulfill({status:503,json:{error:'authentication fixture'}});
    if(op==='auth/logout')result={};
    else if(op==='care/overview')result={wallet:account,chainId:4663,token,decimals:18,revision:revision++,rats,intents};
    else if(op==='care/reserve'){
     assert.equal(data.action,'pet');
     result={id:'12345678-1234-1234-1234-123456789012',rat_id:data.ratId,action:'pet',name:null,cost:5000,units:String(5000n*10n**18n),token,chain_id:4663,status:'reserved',submission_started_at:null,submitted_hash:null,expires_at:String(Date.now()+60000)};intents=[result];
    }else if(op==='care/begin')intents[0].submission_started_at=String(Date.now());
    else if(op==='care/submitted'){assert.equal(data.hash,hash);intents[0].submitted_hash=hash;}
    else if(op==='care/finalize'){assert.equal(data.hash,hash);intents[0].status='applied';result={status:'applied'};}
    else if(op==='care/cancel')intents=[];
    else throw Error('Unexpected payment operation '+op);
    return route.fulfill({json:result});
   }
   if(u.pathname.startsWith('/api/'))return route.fulfill({status:503,json:{error:'isolated test'}});
   const response=await context.request.get('http://127.0.0.1:5174'+u.pathname+u.search);
   await route.fulfill({response});
  });
  await p.addInitScript(({account,hash})=>{
   localStorage.setItem('rattery:welcome-explainer:v2','done');window.walletCalls=[];
   window.ethereum={on(){},removeListener(){},async request({method,params}){
    window.walletCalls.push({method,params});
    if(method==='eth_accounts'||method==='eth_requestAccounts')return [account];
    if(method==='eth_chainId')return '0x1237';
    if(method==='eth_call')return '0x'+(10n**30n).toString(16);
    if(method==='eth_sendTransaction')return hash;
    throw Error('Unexpected wallet call '+method);
   }};
  },{account,hash});
  await p.goto('https://rattery.tech/');
  await p.locator('.burrow-host').waitFor();
  rats=await p.evaluate(async()=>{const s=await import('/src/store.ts');const {createWorld}=await import('/src/sim/colony.ts');Object.assign(s.getWorld(),createWorld(9));return Object.values(s.getWorld().rats).slice(0,2).map(r=>({id:r.id,name:r.name,owner:null,dead:false}));});
  assert.equal(rats.length,2);
  rats[1].owner='0x2222222222222222222222222222222222222222';
  await p.evaluate(async({account,id})=>{const w=await import('/src/wallet.ts');w.discoverWallets();await w.connectWallet('legacy');w.useWallet.setState({authenticated:true,account,chainId:'0x1237'});const s=await import('/src/store.ts');s.useStore.getState().focus(id);},{account,id:rats[0].id});
  const care=p.locator('.paid-care');await care.locator('.care-picker').waitFor();
  await care.locator('.care-option').filter({has:p.locator('strong',{hasText:/^Pet$/})}).click();
  assert.equal(calls.filter(x=>x==='care/reserve').length,0,'Selecting an action must not reserve or pay');
  await care.getByRole('button',{name:'Review action & cost',exact:true}).click();
  await care.getByRole('button',{name:'Confirm Burn',exact:true}).waitFor();
  assert.equal(await p.evaluate(()=>window.walletCalls.filter(x=>x.method==='eth_sendTransaction').length),0);
  await p.screenshot({path:path.join(outputDir,`paid-care-review-${width}.png`)});
  await care.getByRole('button',{name:'Confirm Burn',exact:true}).click();
  await care.getByText('Submission started. Recover the existing transaction.',{exact:true}).waitFor();
  assert(await care.getByRole('button',{name:'Confirm Burn',exact:true}).isDisabled());
  const sends=await p.evaluate(()=>window.walletCalls.filter(x=>x.method==='eth_sendTransaction'));
  assert.equal(sends.length,1);assert.equal(sends[0].params[0].to,token);assert(sends[0].params[0].data.startsWith('0x42966c68'));assert.equal(BigInt('0x'+sends[0].params[0].data.slice(10)),5000n*10n**18n);
  await care.getByRole('button',{name:'Recover transaction',exact:true}).click();
  await care.getByText('Confirmed and applied. No second burn.',{exact:true}).waitFor();
  assert.equal(await p.evaluate(()=>window.walletCalls.filter(x=>x.method==='eth_sendTransaction').length),1);
  await care.getByLabel('Choose a rat for mint and care',{exact:true}).selectOption(rats[1].id);
  await care.getByText('Only the owner can provide care.',{exact:true}).waitFor();
  assert(await care.locator('.care-option').filter({has:p.locator('strong',{hasText:/^Pet$/})}).isDisabled());
  assert.deepEqual(errors,[]);console.log('PASS isolated PaidCare',width,'selection, reservation, exact burn, duplicate guard, recovery, ownership');
  await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});