const {chromium,outputDir}=require('./lib/browser-runtime.cjs');
const {Wallet}=require('ethers');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const wallet=Wallet.createRandom();
 const browser=await chromium.launch({headless:true});
 try{
 const context=await browser.newContext();
 const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('testSign',hex=>wallet.signMessage(Buffer.from(hex.slice(2),'hex')));
 await page.addInitScript(({address})=>{
  window.walletCalls=[];window.walletMode='ok';window.walletHandlers={};
  window.ethereum={request:async({method,params})=>{
   window.walletCalls.push(method);
   if(['eth_requestAccounts','eth_accounts'].includes(method))return [address];
   if(method==='eth_chainId')return window.walletMode==='network'?'0x1':'0xb626';
   if(method==='personal_sign'){
    if(window.walletMode==='reject')throw {code:4001};
    if(window.walletMode==='defer')await new Promise(r=>window.releaseSignature=r);
    return window.testSign(params[0]);
   }
   throw Error('Forbidden wallet RPC '+method);
  },on:(event,fn)=>(window.walletHandlers[event]??=new Set()).add(fn),removeListener:(event,fn)=>window.walletHandlers[event]?.delete(fn)};
 },{address:wallet.address});
 const url=process.env.RATTERY_TEST_URL||'https://rattery-staging.vercel.app/';
 await page.goto(url);await page.locator('.wallet-trigger').waitFor();if(await page.locator('.welcome-tour').isVisible())await page.getByRole('button',{name:'Skip',exact:true}).click();await page.locator('.wallet-trigger').click();
 const connect=async()=>{await page.getByRole('button',{name:'Browser wallet',exact:true}).click();await page.getByRole('button',{name:'Sign in with wallet',exact:true}).waitFor();};
 await connect();
 assert(!(await page.evaluate(()=>window.walletCalls)).includes('personal_sign'));
 await page.getByRole('button',{name:'Sign in with wallet',exact:true}).click();
 await page.getByText('Verified staging sign-in',{exact:true}).waitFor({timeout:30000});
 const session=await page.evaluate(()=>fetch('/api/session?op=session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json()));
 assert.equal(session.wallet,wallet.address.toLowerCase());assert.equal(session.paymentsEnabled,false);
 const cookies=await context.cookies();const cookie=cookies.find(c=>c.name==='rattery_session');
 assert(cookie?.httpOnly&&cookie.secure&&cookie.sameSite==='Strict');
 assert.equal(await page.evaluate(()=>document.cookie.includes('rattery_session')),false);
 await page.screenshot({path:path.join(outputDir,'staging-login.png')});
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await connect();await page.evaluate(()=>window.walletMode='reject');
 await page.getByRole('button',{name:'Sign in with wallet',exact:true}).click();
 await page.getByText('Signature declined. You are not signed in.',{exact:true}).waitFor();
 await page.evaluate(()=>window.walletMode='defer');
 await page.getByRole('button',{name:'Sign in with wallet',exact:true}).click();
 await page.waitForFunction(()=>typeof window.releaseSignature==='function');
 await page.evaluate(()=>window.walletHandlers.accountsChanged.forEach(fn=>fn([])));
 await page.evaluate(()=>window.releaseSignature());
 await page.getByRole('button',{name:'Browser wallet',exact:true}).waitFor();
 const after=await page.evaluate(()=>fetch('/api/session?op=session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json()));
 assert.equal(after.wallet,null);
 await page.evaluate(()=>window.walletMode='network');await connect();
 await page.getByRole('button',{name:'Sign in with wallet',exact:true}).click();
 await page.getByText('Switch to testnet 46630 and reconnect.',{exact:true}).waitFor();
 assert((await page.evaluate(()=>window.walletCalls)).every(m=>['eth_requestAccounts','eth_accounts','eth_chainId','personal_sign'].includes(m)));
 assert.deepEqual(errors,[]);
 console.log('PASS deployed browser SIWE: real ephemeral signature, secure HttpOnly session, disabled payments, logout, rejection, account change during signing, wrong network; no transaction RPC');
 }finally{await browser.close();}
})().catch(e=>{console.error('FAIL staging login browser test: '+String(e.message).slice(0,900));process.exit(1);});
