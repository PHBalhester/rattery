import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {Wallet} from 'ethers';
import {createServer as viteServer} from 'vite';
import {chromium} from 'playwright';
import {StagingAuth} from '../server/auth';
import {Persistence} from '../server/persistence';
import {stagingHandler} from '../server/http';
import {createWorld} from '../src/sim/colony';
import {startSimulationWorker} from '../server/simulation-worker';
import {readObservation} from '../server/observer';
if(!process.env.PGDATABASE?.endsWith('_test'))throw Error('Isolated test database required');
const schema='ui_'+randomUUID().replaceAll('-',''),setup=new Pool();await setup.query('CREATE SCHEMA '+schema);await setup.end();
const db=new Pool({options:'-c search_path='+schema+',public'});
for(const name of ['001_staging','002_auth_expiry','003_submission_recovery','004_shared_simulation','005_trade_ledger','006_market_collector','007_engine_history','008_payment_mainnet','009_reconciliation','010_cancel_unsigned','011_residence'])await db.query(readFileSync('server/migrations/'+name+'.sql','utf8'));
const wallet=Wallet.createRandom(),owner=wallet.address.toLowerCase(),token='0xc322305e79337300b59ff48389f8c9a1d9e0de76',burns=new Map<string,any>();let sends=0;
const blockHash='0x'+'b'.repeat(64);
const rpc=async(method:string,params:any[])=>{
 if(method==='eth_call')return '0x'+(1_000_000_000n*10n**18n).toString(16);
 if(method==='eth_chainId')return '0x1237';if(method==='eth_blockNumber')return '0x78';
 if(method==='eth_getBlockByNumber')return {number:'0x64',hash:blockHash,timestamp:'0x'+Math.floor(Date.now()/1000).toString(16)};
 const entry=burns.get(params[0]);if(!entry)return null;
 if(method==='eth_getTransactionByHash')return {hash:params[0],from:owner,to:token,input:entry.data,value:'0x0'};
 if(method==='eth_getTransactionReceipt')return {transactionHash:params[0],from:owner,to:token,status:'0x1',blockNumber:'0x64',blockHash,logs:[{address:token,topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef','0x'+owner.slice(2).padStart(64,'0'),'0x'+'0'.repeat(64)],data:'0x'+entry.data.slice(10),logIndex:'0x0'}]};
 throw Error('Unexpected verification method');
};
const auth=new StagingAuth(db,'https://rattery.tech',Date.now,4663),service=new Persistence(db,auth,token,18,rpc),world=createWorld();
for(const r of Object.values(world.rats)){r.energy=.5;r.socialAction=undefined;}
await service.initialize(world);await service.advanceSimulation();const stop=startSimulationWorker(service,()=>{});
process.env.VITE_MAINNET_PAYMENTS='true';process.env.VITE_STAGING='false';
const vite=await viteServer({server:{middlewareMode:true,hmr:false,allowedHosts:['rattery.tech']},appType:'spa'}),handle=stagingHandler(auth,service);
const server=createServer(async(req,res)=>{
 const url=new URL(req.url??'/','http://local.invalid');
 if(url.pathname==='/api/payment'){req.url='/'+url.searchParams.get('op');return handle(req,res);}
 if(url.pathname==='/api/observer'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(await readObservation(db,'rattery-production-test')));}
 if(url.pathname==='/api/chain'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ok:true,launched:true,chainId:4663,token:{address:token,supply:1e9},block:100,feed:{birthBlock:1,chunkBlocks:100,headChunk:1},updated:Math.floor(Date.now()/1000),links:{}}));}
 if(url.pathname==='/lab/wallet'){
  let raw='';for await(const part of req)raw+=part;const {method,params=[]}=JSON.parse(raw);let result:unknown;
  if(['eth_accounts','eth_requestAccounts'].includes(method))result=[owner];else if(method==='eth_chainId')result='0x1237';else if(method==='personal_sign')result=await wallet.signMessage(Buffer.from(params[0].slice(2),'hex').toString('utf8'));else if(method==='eth_call')result='0x'+(10_000_000n*10n**18n).toString(16);else if(method==='eth_sendTransaction'){assert.equal(params[0].to,token);assert.equal(params[0].from,owner);assert.equal(params[0].value,'0x0');assert.equal(params[0].chainId,'0x1237');assert(params[0].data.startsWith('0x42966c68'));result='0x'+(++sends).toString(16).padStart(64,'0');burns.set(String(result),params[0]);}else throw Error('Unexpected wallet method');
  res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({result}));
 }
 vite.middlewares(req,res);
});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const local='http://127.0.0.1:'+(server.address() as any).port;
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}});const errors:string[]=[];
 await context.route('https://rattery.tech/**',async route=>{const u=new URL(route.request().url());const response=await route.fetch({url:local+u.pathname+u.search,headers:{...route.request().headers(),host:'rattery.tech'}});await route.fulfill({response});});
 await context.addInitScript({content:"localStorage.setItem('rattery:welcome-tour:v1','done');let walletNetwork='0x1';const listeners={};window.ethereum={request:async function(args){if(args.method==='eth_chainId')return walletNetwork;if(args.method==='wallet_switchEthereumChain'){if(args.params[0].chainId!=='0x1237')throw Error('Wrong switch target');walletNetwork='0x1237';(listeners.chainChanged||[]).forEach(fn=>fn(walletNetwork));return null;}const r=await fetch('/lab/wallet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)});return (await r.json()).result;},on:function(e,fn){(listeners[e]??=[]).push(fn);},removeListener:function(e,fn){listeners[e]=(listeners[e]||[]).filter(f=>f!==fn);}};"});
 const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.log('Browser error',e.message)});await page.goto('https://rattery.tech/');console.log('Page loaded',await page.title());
 const login=async()=>{await page.locator('.wallet-trigger').click();await page.getByRole('button',{name:'Browser wallet',exact:true}).click();await page.getByText('Wallet ownership verified',{exact:true}).waitFor();await page.getByRole('button',{name:'Close wallet panel',exact:true}).click();};
 await login();await page.locator('.production-residents button').first().click();await page.locator('.readout-tabs').getByRole('button',{name:'Rat',exact:true}).click();
 await page.locator('.paid-care').getByLabel('Name',{exact:true}).fill('Browser Mint');await page.getByRole('button',{name:'Review action & cost',exact:true}).click();await page.getByRole('button',{name:'Confirm Burn',exact:true}).click();await page.getByText('Transaction sent. Confirmation continues automatically; do not pay again.',{exact:true}).waitFor();assert.equal(sends,1);
 await page.reload();await login();await page.locator('.readout-tabs').getByRole('button',{name:'Rat',exact:true}).click();await page.getByText('Pending actions',{exact:false}).waitFor();await page.locator('.paid-care details button').first().click();assert(await page.getByRole('button',{name:'Confirm Burn',exact:true}).isDisabled());
 assert.equal((await service.reconcileSubmitted()).applied,1);await page.getByRole('button',{name:'Check status',exact:true}).click();assert.equal(sends,1);assert.equal((await db.query('SELECT count(*) FROM rat_ownership')).rows[0].count,'1');assert.equal((await db.query('SELECT count(*) FROM burn_receipts')).rows[0].count,'1');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/production-care-mobile.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS production browser: mainnet sign-in, reservation, exact native burn, reload, background recovery, single receipt and ownership, no page errors');
}finally{await browser.close();await stop();await vite.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.end();}
