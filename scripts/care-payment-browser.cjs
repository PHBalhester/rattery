const {chromium,outputDir}=require('./lib/browser-runtime.cjs');
const assert=require('node:assert/strict');const path=require('node:path');
const origin='http://localhost:18756';
const lab=async(op,data={})=>{const r=await fetch(origin+'/lab/'+op,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});return r.json();};
(async()=>{
 const browser=await chromium.launch({headless:true});let passed=false;
 try{
 const context=await browser.newContext();const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{
  window.walletMode='ok';window.walletHandlers={};window.calls=[];
  window.ethereum={request:async({method,params=[]})=>{
   window.calls.push(method);
   const result=await fetch('/lab/wallet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,params})}).then(r=>r.json());
   if(result.error)throw Error(result.error);
   if(method==='eth_sendTransaction'&&window.walletMode==='lose-hash')throw Error('Simulated lost wallet response');
   return result.result;
  },on:(e,f)=>(window.walletHandlers[e]??=new Set()).add(f),removeListener:(e,f)=>window.walletHandlers[e]?.delete(f)};
 });
 const info=await lab('info');
 const login=async()=>{
  await page.locator('.wallet-trigger').click();await page.getByRole('button',{name:'Browser wallet',exact:true}).click();
  await page.getByRole('button',{name:'Sign in with wallet',exact:true}).click();
  await page.getByText('Verified staging sign-in',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Close wallet panel',exact:true}).click();
  await page.getByLabel('Rat',{exact:true}).selectOption(info.ratId);
 };
 const reserve=async(action)=>{
  await page.getByLabel('Action',{exact:true}).selectOption(action);
  await page.getByRole('button',{name:'Reserve action',exact:true}).click();
  await page.getByText('Reserved — not submitted',{exact:true}).waitFor();
 };
 await page.goto(origin+'/?view=care-lab');await login();await reserve('mint');
 // Transport failure before the server finalizes; transaction hash is preserved.
 await page.route('**/api/care?op=finalize',route=>route.abort(),{times:1});
 await page.getByRole('button',{name:'Confirm local payment',exact:true}).click();
 await page.getByText('Action not completed. Refresh or recover the existing payment; do not burn again.',{exact:true}).waitFor();
 assert.equal((await lab('info')).sends,1);
 await page.reload();await login();
 await page.getByText('Submission started — recovery only',{exact:true}).waitFor();
 assert(await page.getByRole('button',{name:'Confirm local payment',exact:true}).isDisabled());
 await page.getByRole('button',{name:'Recover payment',exact:true}).click();
 await page.getByText('Recovered without another burn.',{exact:true}).waitFor();
 assert((await page.getByTestId('owner').textContent()).includes(info.wallet));assert.equal((await lab('info')).sends,1);
 console.log('PASS browser mint recovers after reload without second transaction');
 // Server commits feeding, but the response is lost.
 const beforeEnergy=Number(await page.getByTestId('energy').textContent());
 await reserve('feed');
 await page.route('**/api/care?op=finalize',async route=>{await route.fetch();await route.abort();},{times:1});
 await page.getByRole('button',{name:'Confirm local payment',exact:true}).click();
 await page.getByText('Action not completed. Refresh or recover the existing payment; do not burn again.',{exact:true}).waitFor();
 await page.getByLabel('Action',{exact:true}).waitFor();
 assert(Number(await page.getByTestId('energy').textContent())>beforeEnergy);
 assert.equal((await lab('info')).sends,2);
 await page.getByRole('button',{name:'Reserve action',exact:true}).click();
 await page.getByText('Action not completed. Refresh or recover the existing payment; do not burn again.',{exact:true}).waitFor();
 assert.equal((await lab('info')).sends,2);
 console.log('PASS lost commit response restores database state; cooldown blocks repeat charge');
 // Wallet sends but loses the hash. No automated rebroadcast is permitted.
 await reserve('water');await page.evaluate(()=>window.walletMode='lose-hash');
 await page.getByRole('button',{name:'Confirm local payment',exact:true}).click();
 await page.getByText('Submission started — recovery only',{exact:true}).waitFor();
 assert(await page.getByRole('button',{name:'Confirm local payment',exact:true}).isDisabled());
 const lost=await lab('info');assert.equal(lost.sends,3);
 await page.getByRole('button',{name:'Recover payment',exact:true}).click();
 await page.getByText('Action not completed. Refresh or recover the existing payment; do not burn again.',{exact:true}).waitFor();
 assert.equal((await lab('info')).sends,3);
 await page.getByLabel('Transaction hash',{exact:true}).fill(lost.lastHash);
 await page.getByRole('button',{name:'Recover payment',exact:true}).click();
 await page.getByText('Recovered without another burn.',{exact:true}).waitFor();
 assert.equal((await lab('info')).sends,3);
 assert.deepEqual(errors,[]);await page.screenshot({path:path.join(outputDir,'care-lab-recovered.png')});
 console.log('PASS missing wallet hash requires manual recovery; exactly three local burns for three actions');
 passed=true;
 }finally{await lab('finish',{passed});await browser.close();}
})().catch(e=>{console.error(String(e.message).slice(0,1500));process.exit(1);});
