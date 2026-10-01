const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),url=fs.readFileSync(path.join(root,'test-results/settlement/operator-url.txt'),'utf8');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.requests=[];window.ethereum={request:async({method,params})=>{window.requests.push({method,params});if(method==='eth_accounts'||method==='eth_requestAccounts')return ['0xd40ed0214353b746fd567fa4a57409d1b5709988'];if(method==='eth_chainId')return '0x1237';if(method==='eth_getCode')return '0x';if(method==='eth_getTransactionCount')return '0x1';if(method==='eth_estimateGas')return '0x10000';if(method==='eth_sendTransaction')return '0x'+'2'.repeat(64);throw Error('Unexpected method '+method);}};});
  await page.route('**/verify?*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({verified:true,funded:false})}));
  await page.goto(url);await page.locator('#overview').filter({hasText:'Prize deposit: 1 Stock Tokens'}).waitFor();
  assert(await page.locator('#approve').isDisabled());await page.locator('#connect').click();await page.locator('#deploy').click();await page.locator('#hash').filter({}).waitFor();assert.equal(await page.locator('#hash').inputValue(),'0x'+'2'.repeat(64));
  await page.locator('#verify').click();await page.locator('#approve').click();await page.locator('#fund').click();await page.locator('#result').filter({hasText:'Funding submitted'}).waitFor();
  const sends=await page.evaluate(()=>window.requests.filter(x=>x.method==='eth_sendTransaction'));assert.equal(sends.length,3);assert.equal(sends[0].params[0].nonce,'0x1');assert.equal(sends[1].params[0].data,'0x1234');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(root,`test-results/settlement/operator-${width}.png`),fullPage:true});await page.close();
 }console.log('PASS operator browser: desktop/mobile, no overflow, treasury connection, deploy/approval/fund wallet requests, no page errors (mock wallet only)');}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
