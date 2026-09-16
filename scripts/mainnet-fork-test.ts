import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Wallet,Interface,keccak256,AbiCoder,toBeHex,toQuantity} from 'ethers';
import {Pool} from 'pg';
import {verifyBurn} from '../api/_lib/burn.js';
import {StagingAuth} from '../server/auth.js';
import {Persistence} from '../server/persistence.js';
import {createWorld} from '../src/sim/colony.js';
import {burnCall} from '../src/market/burn.js';

const source='https://rpc.mainnet.chain.robinhood.com/rpc';
const contractAddress='0x7dbf38976f6d3b9c529e7d9484a71898b409ee6a';
const nodeURL='http://127.0.0.1:18755',proxyPort=18754;
const allowed=new Set(['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getBlockByHash','eth_getBalance','eth_getTransactionCount','eth_getCode','eth_getStorageAt','eth_getProof','eth_gasPrice','net_version','web3_clientVersion','eth_getTransactionByHash','eth_getTransactionReceipt']);
let readCount=0,blockedUpstreamRequests=0;
const methods:Record<string,number>={};
async function upstream(method:string,params:unknown[]=[]){
 if(!allowed.has(method)){blockedUpstreamRequests++;throw Error('Upstream method prohibited');}
 if(++readCount>1000)throw Error('Read budget exceeded');
 methods[method]=(methods[method]??0)+1;
 const response=await fetch(source,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Upstream HTTP '+response.status);
 const data=await response.json() as any;if(data.error)throw Error(data.error.message);return data.result;
}
const proxy=createServer(async(req,res)=>{
 try{
  if(req.method!=='POST')throw Error('POST required');
  let text='';for await(const chunk of req){text+=chunk;if(text.length>65536)throw Error('Body limit');}
  const input=JSON.parse(text);
  const call=async(x:any)=>{try{return {jsonrpc:'2.0',id:x.id,result:await upstream(x.method,x.params)};}catch(e){return {jsonrpc:'2.0',id:x.id,error:{code:-32601,message:(e as Error).message}};}};
  const result=Array.isArray(input)?await Promise.all(input.map(call)):await call(input);
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
 }catch{res.statusCode=400;res.end('{}');}
});
async function local(method:string,params:unknown[]=[]){
 // All write operations are permanently bound to loopback, never caller-supplied URLs.
 const response=await fetch(nodeURL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(20000)});
 const data=await response.json() as any;if(data.error)throw Error(data.error.message);return data.result;
}
let anvil:ReturnType<typeof spawn>|undefined,db:Pool|undefined;
const passed:string[]=[];const ok=(name:string)=>{passed.push(name);console.log('PASS',name);};
try{
 assert.equal(Number(await upstream('eth_chainId')),4663);
 const block=Number(await upstream('eth_blockNumber'))-20;
 const anchor=await upstream('eth_getBlockByNumber',[toQuantity(block),false]);
 const code=await upstream('eth_getCode',[contractAddress,toQuantity(block)]);assert(code.length>100);
 await assert.rejects(upstream('eth_sendRawTransaction',['0x']));
 await new Promise<void>(resolve=>proxy.listen(proxyPort,'127.0.0.1',resolve));
 anvil=spawn(process.env.RATTERY_ANVIL||'anvil',['--host','127.0.0.1','--port','18755','--accounts','0','--chain-id','46630','--fork-url','http://127.0.0.1:'+proxyPort,'--fork-block-number',String(block),'--no-storage-caching','--silent'],{stdio:['ignore','ignore','pipe']});
 let diagnostics='';anvil.stderr!.on('data',chunk=>diagnostics+=chunk.toString().slice(0,2000));
 let ready=false;for(let i=0;i<100;i++){if(anvil.exitCode!==null)throw Error('Anvil startup failed: '+diagnostics);try{await local('eth_chainId');ready=true;break;}catch{await new Promise(r=>setTimeout(r,200));}}
 assert(ready,'Anvil did not start');
 assert.match(await local('web3_clientVersion'),/anvil/i);assert.equal(Number(await local('eth_chainId')),46630);
 assert.equal(await local('eth_getCode',[contractAddress,'latest']),code);
 ok('Pinned mainnet contract bytecode matches local fork; execution chain isolated as 46630');
 const abi=new Interface(['function symbol() view returns(string)','function decimals() view returns(uint8)','function totalSupply() view returns(uint256)','function balanceOf(address) view returns(uint256)','function burn(uint256)','function transfer(address,uint256) returns(bool)']);
 const call=async(name:string,args:unknown[]=[])=>abi.decodeFunctionResult(name,await local('eth_call',[{to:contractAddress,data:abi.encodeFunctionData(name,args)},'latest']))[0];
 const symbol=String(await call('symbol')),decimals=Number(await call('decimals'));assert.equal(decimals,18);
 const a=Wallet.createRandom(),b=Wallet.createRandom(),address=a.address.toLowerCase();
 await local('anvil_setBalance',[address,toQuantity(10n**20n)]);await local('anvil_impersonateAccount',[address]);
 // Synthetic balance only on the copy: do not need a real holder or private key.
 const funds=5000000n*10n**18n;let balanceSlot=-1;
 for(let slot=0;slot<20;slot++){
  const snapshot=await local('evm_snapshot');
  const key=keccak256(AbiCoder.defaultAbiCoder().encode(['address','uint256'],[address,slot]));
  await local('anvil_setStorageAt',[contractAddress,key,toBeHex(funds,32)]);
  if(await call('balanceOf',[address])===funds){balanceSlot=slot;break;}
  await local('evm_revert',[snapshot]);
 }
 assert(balanceSlot>=0,'Could not identify synthetic balance slot');
 const send=async(data:string)=>{const hash=await local('eth_sendTransaction',[{from:address,to:contractAddress,data,gas:'0x493e0',value:'0x0'}]);for(let i=0;i<100;i++){if(await local('eth_getTransactionReceipt',[hash]))return hash;await new Promise(r=>setTimeout(r,50));}throw Error('Local receipt timeout');};
 const supply=await call('totalSupply');
 const amount=500000n*10n**18n;
 let now=Number((await local('eth_getBlockByNumber',['latest',false])).timestamp)*1000;
 const directIntent={chainId:46630,token:contractAddress,wallet:address,amount,createdAt:now,expiresAt:now+300000};
 const hash=await send(burnCall(contractAddress,amount).data);
 await assert.rejects(verifyBurn(local,hash,directIntent),/not confirmed/);
 await local('anvil_mine',['0x4']);
 const receipt=await verifyBurn(local,hash,directIntent);
 assert.equal(await call('totalSupply'),supply-amount);assert.equal(await call('balanceOf',[address]),funds-amount);
 ok('Real ERC20 burn reduces supply and wallet balance; verifier waits for confirmations and accepts exact receipt');
 for(const change of [{wallet:b.address},{amount:amount+1n},{token:b.address},{chainId:4663},{createdAt:receipt.timestamp+1,expiresAt:receipt.timestamp+300000}])await assert.rejects(verifyBurn(local,hash,{...directIntent,...change}));
 ok('Wrong wallet, amount, contractAddress, chain and payment window rejected against actual receipt');
 const transferHash=await send(abi.encodeFunctionData('transfer',[b.address,amount]));await local('anvil_mine',['0x4']);
 await assert.rejects(verifyBurn(local,transferHash,directIntent));
 const failed=await send(burnCall(contractAddress,funds*100n).data);await local('anvil_mine',['0x4']);
 assert.equal(Number((await local('eth_getTransactionReceipt',[failed])).status),0);
 await assert.rejects(verifyBurn(local,failed,{...directIntent,amount:funds*100n}),/reverted/);
 ok('Ordinary transfer is not a burn; insufficient balance reverts on the real contract');
 const snap=await local('evm_snapshot');const removed=await send(burnCall(contractAddress,1n).data);await local('anvil_mine',['0x4']);
 await verifyBurn(local,removed,{...directIntent,amount:1n});await local('evm_revert',[snap]);
 await assert.rejects(verifyBurn(local,removed,{...directIntent,amount:1n}));
 ok('Receipt removed by local chain rollback is no longer accepted');
 if(!process.env.PGDATABASE?.endsWith('_test'))throw Error('Isolated PostgreSQL test database required');
 const schema='fork_'+randomUUID().replaceAll('-',''),admin=new Pool();
 await admin.query('CREATE SCHEMA '+schema);await admin.end();
 db=new Pool({max:20,options:'-c search_path='+schema+',public'});
 await db.query(readFileSync('server/migrations/001_staging.sql','utf8'));
 now=Number((await local('eth_getBlockByNumber',['latest',false])).timestamp)*1000;
 const auth=new StagingAuth(db,'http://localhost:18756',()=>now);
 const challenge=await auth.challenge(address),session=await auth.verify(challenge.id,challenge.message,await a.signMessage(challenge.message));
 const service=new Persistence(db,auth,contractAddress,18,local,()=>now),world=createWorld();
 await service.initialize(world);const ratId=Object.keys(world.rats)[0];
 const reservations=await Promise.allSettled(Array.from({length:12},()=>service.reserve(session,randomUUID(),ratId,'mint','Fork Rat')));
 const wins=reservations.filter(x=>x.status==='fulfilled') as PromiseFulfilledResult<any>[];assert.equal(wins.length,1);
 const mint=wins[0].value,mintHash=await send(burnCall(contractAddress,BigInt(mint.units)).data);await local('anvil_mine',['0x4']);
 // Inject an application/database failure after the chain burn has succeeded.
 await db.query("CREATE FUNCTION fail_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated failure'; END $$; CREATE TRIGGER fail_event BEFORE INSERT ON care_events FOR EACH ROW EXECUTE FUNCTION fail_event()");
 await assert.rejects(service.finalize(session,mint.id,mintHash));assert.equal((await db.query('SELECT count(*) FROM burn_receipts')).rows[0].count,'0');
 await db.query('DROP TRIGGER fail_event ON care_events; DROP FUNCTION fail_event()');
 const restored=new Persistence(db,auth,contractAddress,18,local,()=>now);
 const results=await Promise.all(Array.from({length:12},()=>restored.finalize(session,mint.id,mintHash)));
 assert(results.every(x=>x.status==='applied'));
 assert.equal((await db.query('SELECT count(*) FROM rat_ownership')).rows[0].count,'1');
 assert.equal((await db.query('SELECT count(*) FROM care_events')).rows[0].count,'1');
 ok('SIWE → 12 competing reservations → real local burn → DB failure → 12 retries: exactly one mint');
 const c2=await auth.challenge(b.address),sessionB=await auth.verify(c2.id,c2.message,await b.signMessage(c2.message));
 await assert.rejects(service.reserve(sessionB,randomUUID(),ratId,'feed'));
 const second=await service.reserve(session,randomUUID(),Object.keys(world.rats)[1],'mint','Duplicate');
 await assert.rejects(service.finalize(session,second.id,mintHash));
 ok('Real receipt cannot mint another rat; foreign wallet cannot care for owned rat');
 const feed=await service.reserve(session,randomUUID(),ratId,'feed');
 const feedHash=await send(burnCall(contractAddress,BigInt(feed.units)).data);await local('anvil_mine',['0x4']);
 assert.equal((await service.finalize(session,feed.id,feedHash)).status,'applied');
 await assert.rejects(service.reserve(session,randomUUID(),ratId,'feed'));
 assert.equal((await db.query('SELECT count(*) FROM care_events')).rows[0].count,'2');
 ok('Paid feeding applies once after real local burn; per-rat cooldown rejects repeat');
 mkdirSync('test-results/mainnet-fork',{recursive:true});
 writeFileSync('test-results/mainnet-fork/report.json',JSON.stringify({passed,contractAddress,symbol,decimals,sourceChain:4663,executionChain:46630,forkBlock:block,forkBlockHash:anchor.hash,bytecodeHash:keccak256(code),syntheticBalanceSlot:balanceSlot,syntheticBalance:funds.toString(),readCount,upstreamMethods:methods,blockedUpstreamRequests,mainnetTransactionsSent:0,schema,scope:'Actual mainnet bytecode/storage fork; synthetic local wallet balance; real local EVM transactions and PostgreSQL. Not a public testnet transaction.'},null,2));
 console.log('ALL PASS',passed.length,'contractAddress',symbol,'fork block',block,'mainnet transactions sent: 0');
}finally{
 if(db)await db.end();
 if(anvil&&anvil.exitCode===null){anvil.kill('SIGTERM');await new Promise(r=>anvil!.once('exit',r));}
 await new Promise<void>(r=>proxy.close(()=>r()));
}
