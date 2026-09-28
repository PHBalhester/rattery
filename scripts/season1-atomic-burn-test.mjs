import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {Wallet,Interface,ContractFactory,keccak256,toQuantity,toBeHex,AbiCoder,id} from 'ethers';
import {seasonBurnCall,seasonApprovalCall,seasonQuoteDomain,SEASON_QUOTE_TYPES,seasonQuoteHash} from '../src/market/seasonBurn.ts';
import {verifySeasonBurn} from '../api/_lib/seasonBurn.ts';

// All writes use this literal loopback URL; no caller-supplied RPC or private keys.
const URL='http://127.0.0.1:18765';
const solc=process.env.RATTERY_SOLC ?? (existsSync('/home/phbal/.svm/0.8.24/solc-0.8.24')?'/home/phbal/.svm/0.8.24/solc-0.8.24':'solc');
const anvilPath=process.env.RATTERY_ANVIL ?? (existsSync('/home/phbal/Rattery/.tools/foundry/anvil')?'/home/phbal/Rattery/.tools/foundry/anvil':'anvil');
assert.match(execFileSync(solc,['--version'],{encoding:'utf8'}),/0\.8\.24/);
const compiled=JSON.parse(execFileSync(solc,['--base-path','.','--include-path','node_modules','--optimize','--via-ir','--evm-version','paris','--combined-json','abi,bin,storage-layout','contracts/SeasonActions.sol','contracts/test/SeasonTestToken.sol'],{encoding:'utf8',maxBuffer:4e6}));
const artifact=compiled.contracts['contracts/SeasonActions.sol:SeasonActions'],ta=compiled.contracts['contracts/test/SeasonTestToken.sol:SeasonTestToken'];
const ri=new Interface(artifact.abi),ti=new Interface(ta.abi);
let verifiedLocal=false;
async function rpc(method,params=[]){
 if(!verifiedLocal&&!['eth_chainId','web3_clientVersion'].includes(method))throw Error('Local chain not verified');
 const r=await fetch(URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(10000)});
 const data=await r.json();if(data.error)throw Error(data.error.message);return data.result;
}
const fork=process.argv.includes('--fork');
const realToken='0xc322305e79337300b59ff48389f8c9a1d9e0de76';
const expectedTokenCodeHash='0xf84e8cd3e698c99e3593a1a0e4d63d4081cf5536473a022266623d4ba55f06f0';
const readMethods=new Set(['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getBlockByHash','eth_getBalance','eth_getTransactionCount','eth_getCode','eth_getStorageAt','eth_getProof','eth_getTransactionByHash','eth_getTransactionReceipt','eth_gasPrice','net_version','web3_clientVersion']);
let upstreamReads=0,proxy,forkBlock,forkHash;
async function upstream(method,params=[]){
 if(!readMethods.has(method))throw Error('Public writes prohibited');
 if(++upstreamReads>1000)throw Error('Public read budget exceeded');
 const response=await fetch('https://rpc.mainnet.chain.robinhood.com/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Public read HTTP '+response.status);const out=await response.json();if(out.error)throw Error(out.error.message);return out.result;
}
if(fork){
 assert.equal(Number(await upstream('eth_chainId')),4663);forkBlock=Number(await upstream('eth_blockNumber'))-20;
 const anchor=await upstream('eth_getBlockByNumber',[toQuantity(forkBlock),false]);forkHash=anchor.hash;
 assert.equal(keccak256(await upstream('eth_getCode',[realToken,toQuantity(forkBlock)])),expectedTokenCodeHash,'Token bytecode changed; review required');
 proxy=createServer(async(req,res)=>{try{let body='';for await(const chunk of req){body+=chunk;if(body.length>65536)throw Error('Request too large');}const input=JSON.parse(body);const one=async x=>{try{return {jsonrpc:'2.0',id:x.id,result:await upstream(x.method,x.params)};}catch(e){return {jsonrpc:'2.0',id:x.id,error:{code:-32601,message:e.message}};}};res.setHeader('Content-Type','application/json');res.end(JSON.stringify(Array.isArray(input)?await Promise.all(input.map(one)):await one(input)));}catch{res.writeHead(400);res.end('{}');}});
 await new Promise(resolve=>proxy.listen(18766,'127.0.0.1',resolve));
}
const child=spawn(anvilPath,['--host','127.0.0.1','--port','18765','--chain-id','46630','--accounts','4','--silent',...(fork?['--fork-url','http://127.0.0.1:18766','--fork-block-number',String(forkBlock),'--no-storage-caching']:[])],{stdio:['ignore','ignore','pipe']});
let stderr='';child.stderr.on('data',b=>stderr+=b.toString().slice(0,1500));child.on('error',e=>stderr=e.message);
const passes=[];
try{
 let ready=false;for(let i=0;i<60;i++){if(child.exitCode!==null)throw Error('Anvil startup failed: '+stderr);try{assert.equal(Number(await rpc('eth_chainId')),46630);assert.match(await rpc('web3_clientVersion'),/anvil/i);ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}
 assert(ready,'Local anvil unavailable');verifiedLocal=true;
 const [owner,a,b,c]=await rpc('eth_accounts');
 async function send(from,to,data,extra={}){const hash=await rpc('eth_sendTransaction',[{from,...(to?{to}:{}),data,gas:'0x7a1200',...extra}]);for(let attempt=0;attempt<100;attempt++){const receipt=await rpc('eth_getTransactionReceipt',[hash]);if(receipt)return {hash,receipt};await new Promise(r=>setTimeout(r,10));}throw Error('Local receipt timeout');}
 async function deploy(art,args=[]){const tx=await new ContractFactory(art.abi,art.bin).getDeployTransaction(...args);const {receipt}=await send(owner,null,tx.data);assert.equal(Number(receipt.status),1);return receipt.contractAddress;}
 async function call(to,abi,name,args=[]){return abi.decodeFunctionResult(name,await rpc('eth_call',[{to,data:abi.encodeFunctionData(name,args)},'latest']));}
 async function invoke(from,to,abi,name,args=[]){return send(from,to,abi.encodeFunctionData(name,args));}
 async function now(){return BigInt((await rpc('eth_getBlockByNumber',['latest',false])).timestamp);}
 async function at(time){
  // Time-boundary fixtures restore a neutral checkpoint directly; actual checkpoint behavior is tested separately below.
  const slot=artifact['storage-layout'].storage.find(x=>x.label==='colonySlot').slot;
  const value=time>open?(time-open)/600n:0n;
  for(const target of [router,strict])await rpc('anvil_setStorageAt',[target,toBeHex(BigInt(slot),32),toBeHex(value,32)]);
  await rpc('evm_setNextBlockTimestamp',[Number(time)]);await rpc('evm_mine');
 }
 const signer=Wallet.createRandom(),token=fork?realToken:await deploy(ta),open=await now()+100n,close=open+155n*3600n,season=id('local-season-1');
 const router=await deploy(artifact,[token,signer.address,season,open,close,true]);
 const strict=await deploy(artifact,[token,signer.address,id('local-strict-season'),open,close,false]);
 const config={chainId:46630,token,router,quoteSigner:signer.address};
 const routerCodeHash=keccak256(await rpc('eth_getCode',[router,'latest']));
 if(fork){
  assert.equal(keccak256(await rpc('eth_getCode',[token,'latest'])),expectedTokenCodeHash);
  let found=false;for(let slot=0;slot<20;slot++){const snap=await rpc('evm_snapshot');const key=keccak256(AbiCoder.defaultAbiCoder().encode(['address','uint256'],[owner,slot]));await rpc('anvil_setStorageAt',[token,key,toBeHex(100000000n,32)]);if((await call(token,ti,'balanceOf',[owner]))[0]===100000000n){found=true;break;}await rpc('evm_revert',[snap]);}assert(found,'Synthetic local balance slot not found');
 }
 for(const w of [a,b,c]){assert.equal(Number((await invoke(owner,token,ti,'transfer',[w,1000000n])).receipt.status),1);}
 await at(open);
 async function make(wallet,kind,nest,overrides={},cfg=config){
  const member=await call(cfg.router,ri,'members',[wallet]),[nonce]=await call(cfg.router,ri,'nonces',[wallet]),[sid]=await call(cfg.router,ri,'season');
  const time=await now();const price=kind===0?(await call(cfg.router,ri,'entryPrice',[time]))[0]:[200n,1000n,2000n][kind-1];
  const q={season:sid,wallet,nonce,membership:member.id,kind,nest,amount:100n,usdCents:price,issuedAt:time,expiresAt:time+60n,...overrides};
  const signature=await signer.signTypedData(seasonQuoteDomain(cfg),SEASON_QUOTE_TYPES,q);return {q,signature,cfg};
 }
 async function approve(bundle){const tx=seasonApprovalCall(bundle.cfg,bundle.q);assert.equal(Number((await send(bundle.q.wallet,tx.to,tx.data)).receipt.status),1);}
 async function execute(bundle,approveFirst=true){if(approveFirst)await approve(bundle);const tx=seasonBurnCall(bundle.cfg,bundle.q,bundle.signature);return send(bundle.q.wallet,tx.to,tx.data);}
 async function action(w,kind,nest){const bundle=await make(w,kind,nest);const result=await execute(bundle);assert.equal(Number(result.receipt.status),1);return {...result,...bundle};}
 async function state(w){return {balance:(await call(token,ti,'balanceOf',[w]))[0],supply:(await call(token,ti,'totalSupply'))[0],routerBalance:(await call(token,ti,'balanceOf',[router]))[0],nonce:(await call(router,ri,'nonces',[w]))[0],member:(await call(router,ri,'members',[w])).toArray(),nests:await Promise.all([1,2,3].map(async n=>(await call(router,ri,'nests',[n])).toArray()))};}
 async function rejected(bundle,options={}){const before=await state(bundle.q.wallet);const tx={to:bundle.cfg.router,data:ri.encodeFunctionData('execute',[bundle.q,bundle.signature])};const result=await send(options.from??bundle.q.wallet,tx.to,tx.data,options.value?{value:options.value}:{});assert.equal(Number(result.receipt.status),0);assert.deepEqual(await state(bundle.q.wallet),before);return result;}
 async function check(name,fn){const snap=await rpc('evm_snapshot');try{await fn();passes.push(name);console.log('PASS',name);}finally{await rpc('evm_revert',[snap]);}}
 await check('valid signed entry: exact wallet balance and supply decrease, event and receipt verifier agree',async()=>{
  const before=await state(a),r=await action(a,0,1),after=await state(a);assert.equal(after.balance,before.balance-100n);assert.equal(after.supply,before.supply-100n);assert.equal(after.routerBalance,0n);assert.equal(after.nests[0][0],100n);
  assert.equal((await call(router,ri,'quoteDigest',[r.q]))[0],seasonQuoteHash(config,r.q));
  await assert.rejects(verifySeasonBurn(rpc,r.hash,{config,quote:r.q,signature:r.signature,routerCodeHash}),/not confirmed/);
  await rpc('anvil_mine',['0x4']);const proof=await verifySeasonBurn(rpc,r.hash,{config,quote:r.q,signature:r.signature,routerCodeHash});assert.equal(proof.points,'100');assert.equal(proof.amount,'100');
  for(const intent of [{routerCodeHash:'0x'+'1'.repeat(64)},{quote:{...r.q,amount:101n}},{config:{...config,chainId:4663}}])await assert.rejects(verifySeasonBurn(rpc,r.hash,{config,quote:r.q,signature:r.signature,routerCodeHash,...intent}));
  const changed=async(method,args)=>{const out=await rpc(method,args);if(method==='eth_getBlockByNumber')return {...out,hash:'0x'+'2'.repeat(64)};return out;};await assert.rejects(verifySeasonBurn(changed,r.hash,{config,quote:r.q,signature:r.signature,routerCodeHash}),/anchor/);
 });
 await check('expired quote reverts on EVM: wallet, supply, nonce and points unchanged',async()=>{const q=await make(a,0,1);await approve(q);await at(q.q.expiresAt);await rejected(q);});
 await check('exact expiry timestamp rejects; 59-second boundary accepts',async()=>{
  const q=await make(a,0,1);await approve(q);await rpc('evm_setNextBlockTimestamp',[Number(q.q.expiresAt-1n)]);assert.equal(Number((await execute(q,false)).receipt.status),1);
  const q2=await make(b,0,2);await approve(q2);await rpc('evm_setNextBlockTimestamp',[Number(q2.q.expiresAt)]);await rejected(q2);
 });
 await check(fork?'real-token insufficient allowance/balance roll back action and token state':'insufficient allowance, balance, failing burn and fake burn all roll back action and token state',async()=>{
  let q=await make(a,0,1);await rejected(q);
  q=await make(a,0,1,{amount:2000000n});await approve(q);await rejected(q);
  if(!fork){q=await make(a,0,1);await approve(q);await invoke(owner,token,ti,'setFailure',[true,false]);await rejected(q);await invoke(owner,token,ti,'setFailure',[false,true]);await rejected(q);}
 });
 await check('nonce prevents replay; old membership quote invalid after switch',async()=>{
  const r=await action(a,0,1);await rejected(r);const old=await make(a,1,1);await action(a,0,2);await approve(old);await rejected(old);
  assert.equal((await call(router,ri,'contributions',[1n]))[0],100n);assert.equal((await call(router,ri,'members',[a])).nest,2n);
 });
 await check('signature binds wallet, target, amount, season, action, chain and router',async()=>{
  const q=await make(a,0,1);await approve(q);
  for(const edit of [{nest:2},{amount:101n},{kind:1},{season:id('wrong')},{wallet:b}])await rejected({...q,q:{...q.q,...edit}});
  await rejected(q,{from:b});
  for(const domain of [{...seasonQuoteDomain(config),chainId:4663},{...seasonQuoteDomain(config),verifyingContract:strict}])await rejected({...q,signature:await signer.signTypedData(domain,SEASON_QUOTE_TYPES,q.q)});
 });
 await check('invalid lifetime, future issuance, wrong USD price, invalid nest and native value reject',async()=>{
  for(const edit of [{expiresAt:await now()+61n},{issuedAt:await now()+500n,expiresAt:await now()+550n},{usdCents:999n},{nest:0}]){const q=await make(a,0,1,edit);await rejected(q);}
  const q=await make(a,0,1);await approve(q);await rejected(q,{value:'0x1'});
 });
 await check('pause authorization and emergency rejection do not consume tokens',async()=>{
  assert.equal(Number((await invoke(a,router,ri,'setPaused',[true])).receipt.status),0);
  const q=await make(a,0,1);await approve(q);await invoke(owner,router,ri,'setPaused',[true]);await rejected(q);await invoke(owner,router,ri,'setPaused',[false]);assert.equal(Number((await execute(q,false)).receipt.status),1);
 });
 await check('shared shield: competing wallet cannot buy unavailable shield; failed quote does not burn',async()=>{
  await action(a,0,1);await action(b,0,1);const q=await make(b,2,1);await approve(q);await action(a,2,1);await rejected(q);
 });
 await check('blocked attack consumes shield and attacking cooldown; rewards are preserved',async()=>{
  await action(a,0,1);await action(b,0,2);await action(c,0,2);await action(a,2,1);await action(b,3,1);
  assert.equal((await call(router,ri,'nests',[1])).score,100n);assert.equal((await call(router,ri,'nests',[1])).shieldUntil,0n);
  const q=await make(c,3,3);await approve(q);await rejected(q);assert.equal((await call(router,ri,'contributions',[1n]))[0],100n);
 });
 await check('shield expiration and 30-minute reactivation; attack damage and preserved contributions',async()=>{
  await action(a,0,1);await action(b,0,2);await action(a,2,1);const until=(await call(router,ri,'nests',[1])).shieldUntil;
  await at(until);await action(b,3,1);assert.equal((await call(router,ri,'nests',[1])).score,90n);assert.equal((await call(router,ri,'contributions',[1n]))[0],100n);
  const q=await make(a,2,1);await approve(q);await rejected(q);await at((await call(router,ri,'nests',[1])).shieldReady);await action(a,2,1);
 });
 await check('switch cutoff and season cutoff reject on-chain even when quote remains valid',async()=>{
  await action(a,0,1);await at(close-5n*3600n-10n);const q=await make(a,0,2);await approve(q);await at(close-5n*3600n);await rejected(q);await action(b,0,2);
  await at(close-10n);const late=await make(c,0,3);await approve(late);await at(close);await rejected(late);
 });
 await check('both explicit entry-price policies work across band transition; no implicit product choice',async()=>{
  await at(close-72n*3600n-10n);const q=await make(a,0,1);const q2=await make(b,0,1,{}, {...config,router:strict});await approve(q);await approve(q2);
  await at(close-72n*3600n);assert.equal(Number((await execute(q,false)).receipt.status),1);await rejected(q2);
 });
 await check('same-block order executes shield before attack, with two real transactions',async()=>{
  await action(a,0,1);await action(b,0,2);const shield=await make(a,2,1),attack=await make(b,3,1);await approve(shield);await approve(attack);
  await rpc('evm_setAutomine',[false]);try{
   const first=seasonBurnCall(config,shield.q,shield.signature),second=seasonBurnCall(config,attack.q,attack.signature);
   const h1=await rpc('eth_sendTransaction',[{from:a,...first,gas:'0x7a1200',gasPrice:'0x77359400'}]);
   const h2=await rpc('eth_sendTransaction',[{from:b,...second,gas:'0x7a1200',gasPrice:'0x3b9aca00'}]);await rpc('evm_mine');
   const r1=await rpc('eth_getTransactionReceipt',[h1]),r2=await rpc('eth_getTransactionReceipt',[h2]);assert.equal(r1.blockNumber,r2.blockNumber);assert(Number(r1.transactionIndex)<Number(r2.transactionIndex));assert.equal(Number(r1.status),1);assert.equal(Number(r2.status),1);assert.equal((await call(router,ri,'nests',[1])).score,100n);
  }finally{await rpc('evm_setAutomine',[true]);}
 });
 await check('colony points: half units, ordering, role checks and zero floor',async()=>{
  await action(a,0,1);
  await rpc('evm_setNextBlockTimestamp',[Number(open+600n)]);await rpc('evm_mine');
  assert.equal(Number((await invoke(a,router,ri,'applyColonyPoints',[1,[1,2,4]])).receipt.status),0);
  assert.equal(Number((await invoke(owner,router,ri,'applyColonyPoints',[2,[1,2,4]])).receipt.status),0);
  assert.equal(Number((await invoke(owner,router,ri,'applyColonyPoints',[1,[1,2,4]])).receipt.status),1);
  assert.equal((await call(router,ri,'nests',[1])).halfPoint,1n);
  assert.equal((await call(router,ri,'nests',[2])).score,1n);
  assert.equal((await call(router,ri,'nests',[3])).score,2n);
  assert.equal(Number((await invoke(owner,router,ri,'applyColonyPoints',[1,[1,2,4]])).receipt.status),0);
  await rpc('evm_setNextBlockTimestamp',[Number(open+1200n)]);await rpc('evm_mine');
  assert.equal(Number((await invoke(owner,router,ri,'applyColonyPoints',[2,[1,-4,-4]])).receipt.status),1);
  assert.equal((await call(router,ri,'nests',[1])).score,101n);
  assert.equal((await call(router,ri,'nests',[1])).halfPoint,0n);
  assert.equal((await call(router,ri,'nests',[2])).score,0n);
 });
 await check('missing colony checkpoint rejects without burn, then allows action after checkpoint',async()=>{
  await rpc('evm_setNextBlockTimestamp',[Number(open+600n)]);await rpc('evm_mine');
  const q=await make(a,0,1);await approve(q);await rejected(q);
  assert.equal(Number((await invoke(owner,router,ri,'applyColonyPoints',[1,[4,0,0]])).receipt.status),1);
  assert.equal(Number((await execute(q,false)).receipt.status),1);
  assert.equal((await call(router,ri,'nests',[1])).score,102n);
 });
 mkdirSync('test-results',{recursive:true});writeFileSync(fork?'test-results/season1-atomic-burn-fork.json':'test-results/season1-atomic-burn.json',JSON.stringify({scope:fork?'Real RATTERY bytecode on local fork; synthetic balances; no public transactions':'Local EVM only; no public transactions',forkBlock,forkHash,upstreamReads,mainnetTransactionsSent:0,compiler:'0.8.24',chain:46630,groups:passes.length,passed:passes,routerRuntimeBytes:(await rpc('eth_getCode',[router,'latest'])).slice(2).length/2,routerCodeHash},null,2));
 console.log('ALL PASS',passes.length,'atomic burn groups; public transactions: 0');
}finally{if(child.exitCode===null){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}if(proxy)await new Promise(r=>proxy.close(r));}
