import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createServer as viteServer} from 'vite';
import type {Pool} from 'pg';
import type {HDNodeWallet} from 'ethers';
import {StagingAuth} from '../server/auth.js';
import {Persistence} from '../server/persistence.js';
import {stagingHandler} from '../server/http.js';
import {startSimulationWorker} from '../server/simulation-worker.js';
import type {BurnRPC} from '../api/_lib/burn.js';
export async function runCareBrowserLab(db:Pool,rpc:BurnRPC,wallet:HDNodeWallet,other:HDNodeWallet,token:string,ratId:string){
 await db.query(readFileSync('server/migrations/002_auth_expiry.sql','utf8'));
 await db.query(readFileSync('server/migrations/003_submission_recovery.sql','utf8'));
 await db.query(readFileSync('server/migrations/004_shared_simulation.sql','utf8'));
 await db.query(readFileSync('server/migrations/005_trade_ledger.sql','utf8'));
 await db.query(readFileSync('server/migrations/009_reconciliation.sql','utf8'));
 await db.query(readFileSync('server/migrations/010_cancel_unsigned.sql','utf8'));
 process.env.VITE_LOCAL_CARE_LAB='true';process.env.VITE_STAGING='true';
 const origin='http://localhost:18756';
 const auth=new StagingAuth(db,origin),service=new Persistence(db,auth,token,18,rpc);
 const handle=stagingHandler(auth,service);
 const workerErrors:string[]=[];
 const stopWorker=startSimulationWorker(service,()=>workerErrors.push('worker failure'));
 const vite=await viteServer({server:{middlewareMode:true,hmr:false},appType:'spa',clearScreen:false});
 let sends=0,lastHash:string|null=null;
 let finish:(value:boolean)=>void=()=>{};
 const complete=new Promise<boolean>(resolve=>finish=resolve);
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url??'/',origin);
  if(url.pathname==='/api/colony'){req.url='/colony/snapshot';return handle(req,res);}
  if(url.pathname==='/api/session'||url.pathname==='/api/care'){
   req.url=(url.pathname==='/api/session'?'/auth/':'/care/')+url.searchParams.get('op');return handle(req,res);
  }
  if(url.pathname.startsWith('/lab/')){
   res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
   try{
    if(req.method!=='POST'||req.headers.origin!==origin)throw Error('Local lab origin required');
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)throw Error('Body limit');}
    const data=JSON.parse(raw),w=data.account==='b'?other:wallet;
    if(url.pathname==='/lab/info')return res.end(JSON.stringify({ratId,wallet:wallet.address.toLowerCase(),other:other.address.toLowerCase(),sends,lastHash}));
    if(url.pathname==='/lab/finish'){finish(data.passed===true);return res.end('{}');}
    if(url.pathname!=='/lab/wallet')throw Error('Unknown endpoint');
    let result:unknown;
    switch(data.method){
     case 'eth_requestAccounts':case 'eth_accounts':result=[w.address];break;
     case 'eth_chainId':result='0xb626';break;
     case 'web3_clientVersion':result=await rpc('web3_clientVersion',[]);break;
     case 'personal_sign':{
      const message=Buffer.from(data.params[0].slice(2),'hex').toString('utf8');
      if(!message.startsWith('localhost:18756 wants you to sign in with your Ethereum account:')||!message.includes('URI: '+origin))throw Error('Unexpected signature');
      result=await w.signMessage(message);break;
     }
     case 'eth_call':if(data.params[0].to!==token)throw Error('Unexpected contract');result=await rpc('eth_call',data.params);break;
     case 'eth_sendTransaction':{
      const tx=data.params[0];
      if(tx.from!==wallet.address.toLowerCase()||tx.to!==token||tx.value!=='0x0'||!/^0x42966c68[0-9a-f]{64}$/.test(tx.data))throw Error('Unexpected transaction');
      const block=await rpc('eth_getBlockByNumber',['latest',false]);await rpc('evm_setNextBlockTimestamp',[Math.max(Math.floor(Date.now()/1000),Number(block.timestamp)+1)]);
      lastHash=await rpc('eth_sendTransaction',[{...tx,gas:'0x493e0'}]);sends++;
      for(let i=0;i<100;i++){if(await rpc('eth_getTransactionReceipt',[lastHash]))break;await new Promise(r=>setTimeout(r,50));}
      await rpc('anvil_mine',['0x4']);result=lastHash;break;
     }
     default:throw Error('Unsupported wallet method');
    }
    res.end(JSON.stringify({result}));
   }catch{res.statusCode=400;res.end(JSON.stringify({error:'Local fixture rejected request'}));}
   return;
  }
  vite.middlewares(req,res);
 });
 await new Promise<void>(resolve=>server.listen(18756,'127.0.0.1',resolve));
 const timer=setTimeout(()=>finish(false),240000);
 console.log('CARE LAB READY '+origin+'/?view=care-lab');
 try{
  if(!await complete)throw Error('Browser payment lab failed or timed out');
  const owner=(await db.query('SELECT wallet FROM rat_ownership WHERE rat_id=$1',[ratId])).rows[0]?.wallet;
  if(workerErrors.length)throw Error('Worker reported an error');
  if(owner!==wallet.address.toLowerCase())throw Error('Browser mint missing');
  const actions=(await db.query('SELECT action FROM care_intents WHERE rat_id=$1 AND status=$2',[ratId,'applied'])).rows.map(r=>r.action);
  if(!['mint','feed','water'].every(a=>actions.includes(a))||sends!==3)throw Error('Browser action or burn count mismatch');
  return {sends,actions,passed:true};
 }finally{await stopWorker();clearTimeout(timer);server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await vite.close();}
}
