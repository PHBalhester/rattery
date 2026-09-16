
const {chromium}=require('./lib/browser-runtime.cjs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.calls=[];window.mode='ok';window.handlers={};
  const provider={request:async({method})=>{
   window.calls.push(method);
   if(method==='eth_requestAccounts'){
    if(window.mode==='reject')throw {code:4001};
    if(window.mode==='late')await new Promise(r=>window.resolveWallet=r);
    return window.mode==='invalid'?['bad']:['0x1111111111111111111111111111111111111111'];
   }
   if(method==='eth_accounts')return ['0x1111111111111111111111111111111111111111'];
   if(method==='eth_chainId')return '0xb626';
   throw Error('Unexpected method '+method);
  },on:(e,f)=>(window.handlers[e]??=new Set()).add(f),removeListener:(e,f)=>window.handlers[e]?.delete(f)};
  window.ethereum=provider;
  window.addEventListener('eip6963:requestProvider',()=>window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{uuid:'12345678-1234-1234-1234-123456789012',name:'Test Wallet'},provider}})));
 });
 await page.goto('http://localhost:5173/');await page.locator('.wallet-trigger').waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls),[]);
 await page.locator('.wallet-trigger').click();
 await page.getByRole('button',{name:'Test Wallet',exact:true}).click();
 await page.getByText('Disconnect from RATTERY',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls),['eth_requestAccounts','eth_chainId','eth_accounts']);
 assert.equal(await page.locator('.wallet-choices button').count(),0);
 await page.evaluate(()=>window.handlers.accountsChanged.forEach(f=>f([])));
 await page.getByText('Wallet account or network changed. Reconnect to continue.',{exact:true}).waitFor();
 await page.evaluate(()=>window.mode='reject');
 await page.getByRole('button',{name:'Test Wallet',exact:true}).click();
 await page.getByText('Connection declined. No signature or transaction was requested.',{exact:true}).waitFor();
 await page.evaluate(()=>window.mode='invalid');
 await page.getByRole('button',{name:'Test Wallet',exact:true}).click();
 await page.getByText('Could not verify the connection. Unlock your wallet and try again.',{exact:true}).waitFor();
 await page.evaluate(()=>window.mode='ok');
 await page.getByRole('button',{name:'Test Wallet',exact:true}).click();
 await page.getByText('Disconnect from RATTERY',{exact:true}).waitFor();
 await page.evaluate(()=>window.handlers.chainChanged.forEach(f=>f('0x1')));
 await page.getByText('Wallet account or network changed. Reconnect to continue.',{exact:true}).waitFor();
 await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').isVisible(),false);
 await page.setViewportSize({width:390,height:844});
 await page.locator('.wallet-trigger').click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:require('node:path').join(require('./lib/browser-runtime.cjs').outputDir,'wallet-mobile.png')});
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Language / 语言'}).click();
 await page.locator('.wallet-trigger').click();await page.getByRole('heading',{name:'连接您的钱包'}).waitFor();
 assert.equal(errors.length,0,errors.join('; '));
 const clean=await browser.newPage();await clean.goto('http://localhost:5173/');await clean.locator('.wallet-trigger').click();
 await clean.getByText(/No compatible browser wallet detected/).waitFor();
 console.log('PASS: no automatic RPC, provider discovery/deduplication, connect, read-only RPC allowlist, account/network invalidation, rejection, malformed response, Escape, mobile overflow, Chinese and no-wallet fallback.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
