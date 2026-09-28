// Local regression for the sign-in flow: after a successful signature the wallet panel closes by itself;
// a declined signature keeps it open with the error; reopening while signed in does not auto-close.
// Needs a dev server built with VITE_STAGING=true, e.g.:
//   VITE_STAGING=true npx vite --port 5180 --host 127.0.0.1
//   RATTERY_TEST_URL=http://127.0.0.1:5180/ node scripts/wallet-signin-close-browser.cjs
const {chromium}=require('./lib/browser-runtime.cjs');
const {Wallet}=require('ethers');
const {SiweMessage}=require('siwe');
const {randomBytes,randomUUID}=require('node:crypto');
const assert=require('node:assert/strict');
(async()=>{
 const wallet=Wallet.createRandom(),url=process.env.RATTERY_TEST_URL||'http://127.0.0.1:5180/',origin=new URL(url).origin;
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();page.setDefaultTimeout(Number(process.env.RATTERY_TIMEOUT||30000));const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let signedIn=false;
  await page.route('**/api/session?op=*',async route=>{
   const op=new URL(route.request().url()).searchParams.get('op');
   const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
   if(op==='challenge'){const now=Date.now();return json({id:randomUUID(),message:new SiweMessage({domain:new URL(origin).host,address:wallet.address,statement:'Sign in to RATTERY staging. This verifies wallet ownership only; no token transfer, approval or mint is authorized.',uri:origin,version:'1',chainId:46630,nonce:randomBytes(24).toString('hex'),issuedAt:new Date(now).toISOString(),expirationTime:new Date(now+300000).toISOString()}).prepareMessage()});}
   if(op==='verify'){signedIn=true;return json({authenticated:true});}
   if(op==='session')return json({wallet:signedIn?wallet.address.toLowerCase():null,chainId:46630,paymentsEnabled:false});
   if(op==='logout'){signedIn=false;return json({ok:true});}
   return route.fulfill({status:404,body:'{}'});
  });
  await page.exposeFunction('testSign',hex=>wallet.signMessage(Buffer.from(hex.slice(2),'hex')));
  await page.addInitScript(({address})=>{
   try{localStorage.setItem('rattery:welcome-explainer:v2','done');}catch{}
   window.walletMode='ok';
   window.ethereum={request:async({method,params})=>{
    if(['eth_requestAccounts','eth_accounts'].includes(method))return [address];
    if(method==='eth_chainId')return '0xb626';
    if(method==='personal_sign'){if(window.walletMode==='reject')throw {code:4001};return window.testSign(params[0]);}
    throw Error('Forbidden wallet RPC '+method);
   },on:()=>{},removeListener:()=>{}};
  },{address:wallet.address});
  await page.goto(url);await page.locator('.wallet-trigger').click();
  const dialogOpen=()=>page.evaluate(()=>document.querySelector('.wallet-dialog')?.open===true);
  await page.getByRole('button',{name:'Browser wallet',exact:true}).click();
  const signIn=page.getByRole('button',{name:'Sign in with wallet',exact:true});await signIn.waitFor();
  // 1) declined signature: the panel stays open and explains why
  await page.evaluate(()=>{window.walletMode='reject';});await signIn.click();
  await page.locator('.wallet-dialog [role="alert"]').waitFor();await page.waitForTimeout(1600);
  assert.equal(await dialogOpen(),true,'Panel must stay open after a declined signature');
  // 2) successful signature: the panel shows the verified state, then closes by itself
  await page.evaluate(()=>{window.walletMode='ok';});await signIn.click();
  await page.waitForFunction(()=>document.querySelector('.wallet-dialog')?.open===false,null,{timeout:15000});
  assert.match(await page.locator('.wallet-trigger').textContent(),/^0x/i,'Trigger shows the connected address');
  // 3) reopening while signed in (e.g. to sign out) does not auto-close
  await page.locator('.wallet-trigger').click();await page.waitForTimeout(1800);
  assert.equal(await dialogOpen(),true,'Reopened panel must stay open');
  await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS wallet sign-in closes the panel; declined keeps it open; reopening stays open');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
