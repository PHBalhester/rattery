import {AbiCoder,keccak256,id} from 'ethers';
import {TOPIC} from '../api/_lib/pons.js';
import type {TradeLedger,MarketEvent} from './trade-ledger.js';
import type {HistoricalQuote} from './valuation.js';
import {quantity,blockTag,isHash,isAddress,type ReadRPC} from './market-io.js';
export const BURN_TRANSFER=id('Transfer(address,address,uint256)');
const ZERO='0x'+'0'.repeat(40);
const MAINNET={chainId:4663,factory:'0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e',manager:'0x8366a39cc670b4001a1121b8f6a443a643e40951',hook:'0xe5e702641ea86f4ae6cc3cdaed2b886f976be044'};
const topicAddress=(s:string)=>{if(!/^0x0{24}[0-9a-f]{40}$/.test(s))throw Error('Invalid address topic');return '0x'+s.slice(-40);};
const uint=(data:string,index:number)=>BigInt('0x'+data.slice(2+index*64,2+(index+1)*64));
const signed=(data:string,index:number)=>{const value=uint(data,index),n=value>=2n**255n?value-2n**256n:value;if(n<-(2n**127n)||n>=2n**127n)throw Error('Invalid int128');return n;};
function header(value:any,number:number){
 if(!value||quantity(value.number)!==number||!isHash(value.hash)||!isHash(value.parentHash))throw Error('Invalid block header');
 const timestamp=quantity(value.timestamp)*1000;if(!Number.isSafeInteger(timestamp)||timestamp<=0)throw Error('Invalid block timestamp');
 return {number,hash:value.hash,parentHash:value.parentHash,timestamp};
}
function logBase(l:any,b:{number:number;hash:string}){
 if(!l||l.removed!==false||l.blockHash!==b.hash||quantity(l.blockNumber)!==b.number||!isHash(l.transactionHash)||!Array.isArray(l.topics)||!l.topics.every(isHash)||typeof l.data!=='string')throw Error('Invalid log membership');
 quantity(l.logIndex);
}
export interface CollectorConfig {chainId:number;token:string;birthBlock:number;curve:string;poolId:string;factory:string;manager:string;hook:string;confirmations:number;}
/** Discovery must see a real factory launch; no curve override fallback. */
export async function discoverMarket(rpc:ReadRPC,token:string,birthBlock:number,confirmations=20):Promise<CollectorConfig>{
 if(!isAddress(token)||token===ZERO||!Number.isSafeInteger(birthBlock)||birthBlock<1||!Number.isInteger(confirmations)||confirmations<20||confirmations>10000)throw Error('Invalid collector configuration');
 if(quantity(await rpc('eth_chainId',[]))!==4663)throw Error('Collector chain mismatch');
 const head=quantity(await rpc('eth_blockNumber',[]));if(head-birthBlock<confirmations)throw Error('Launch not sufficiently confirmed');
 const b=header(await rpc('eth_getBlockByNumber',[blockTag(birthBlock),false]),birthBlock);
 const logs=await rpc('eth_getLogs',[{address:MAINNET.factory,fromBlock:blockTag(birthBlock),toBlock:blockTag(birthBlock),topics:[TOPIC.tokenLaunched,'0x'+token.slice(2).padStart(64,'0')]}]);
 if(!Array.isArray(logs)||logs.length!==1)throw Error('Unique factory launch required');
 const l=logs[0];logBase(l,b);
 if(l.address!==MAINNET.factory||l.topics.length!==4||l.topics[0]!==TOPIC.tokenLaunched||topicAddress(l.topics[1])!==token||!/^0x[0-9a-f]{192}$/.test(l.data))throw Error('Invalid factory launch');
 if(uint(l.data,0)!==0n)throw Error('Only native ETH launches supported');
 const curve=topicAddress(l.topics[2]);topicAddress(l.topics[3]);if(curve===ZERO)throw Error('Invalid curve');
 const poolId=keccak256(AbiCoder.defaultAbiCoder().encode(['address','address','uint24','int24','address'],[ZERO,token,0,200,MAINNET.hook]));
 // Re-read to detect a branch change during discovery.
 const checked=header(await rpc('eth_getBlockByNumber',[blockTag(birthBlock),false]),birthBlock);if(checked.hash!==b.hash)throw Error('Launch changed during discovery');
 return {...MAINNET,token,birthBlock,curve,poolId,confirmations};
}
export class MarketCollector{
 constructor(readonly ledger:TradeLedger,readonly rpc:ReadRPC,readonly config:CollectorConfig,readonly prices:{quote:(timestamp:number)=>Promise<HistoricalQuote|null>}){}
 async start(anchorNumber:number){
  const cfg=this.config;
  if(!Number.isSafeInteger(anchorNumber)||anchorNumber<cfg.birthBlock-1)throw Error('Invalid start block');
  const head=await this.head();if(anchorNumber>head-cfg.confirmations)throw Error('Anchor not sufficiently confirmed');
  const b=header(await this.rpc('eth_getBlockByNumber',[blockTag(anchorNumber),false]),anchorNumber);
  await this.ledger.initialize(cfg.chainId,cfg.token,b);
  await this.ledger.service.transaction(async c=>{
   await c.query('SELECT id FROM colony_state WHERE id=1 FOR UPDATE');
   const row=(await c.query('SELECT collector_config FROM trade_stream WHERE id=1')).rows[0];
   if(row.collector_config){
    for(const [key,value] of Object.entries(cfg))if(row.collector_config[key]!==value)throw Error('Pinned collector configuration mismatch');
   }else await c.query('UPDATE trade_stream SET collector_config=$1 WHERE id=1',[cfg]);
  });
  await this.anchor();
 }
 private async head(){
  if(quantity(await this.rpc('eth_chainId',[]))!==this.config.chainId)throw Error('Collector chain mismatch');
  return quantity(await this.rpc('eth_blockNumber',[]));
 }
 private async anchor(){
  const row=(await this.ledger.service.pool.query('SELECT * FROM trade_stream WHERE id=1')).rows[0];
  if(!row||row.halted||!row.collector_config)throw Error('Collector stream unavailable');
  for(const [key,value] of Object.entries(this.config))if(row.collector_config[key]!==value)throw Error('Pinned collector configuration mismatch');
  const b=header(await this.rpc('eth_getBlockByNumber',[blockTag(Number(row.last_block)),false]),Number(row.last_block));
  if(b.hash!==row.last_hash){
   await this.ledger.service.transaction(async c=>{
    await c.query('SELECT id FROM colony_state WHERE id=1 FOR UPDATE');
    await c.query("UPDATE trade_stream SET halted=true,halt_reason='canonical-anchor-mismatch' WHERE id=1 AND last_block=$1 AND last_hash=$2",[row.last_block,row.last_hash]);
   });
   throw Error('Canonical anchor changed; review required');
  }
  return b;
 }
 async poll(maxBlocks=10){
  if(!Number.isInteger(maxBlocks)||maxBlocks<1||maxBlocks>100)throw Error('Invalid collection budget');
  const head=await this.head(),anchor=await this.anchor(),safe=head-this.config.confirmations;
  if(anchor.number>safe)throw Error('RPC head behind persisted cursor');
  const end=Math.min(safe,anchor.number+maxBlocks);
  if(end===anchor.number)return {accepted:0,trades:0,through:end,lagBlocks:0};
  // Scan logs first. Persist only event blocks and the end checkpoint.
  const headers=new Map<number,ReturnType<typeof header>>();
  headers.set(end,header(await this.rpc('eth_getBlockByNumber',[blockTag(end),false]),end));
  const filters=[{address:this.config.curve,topics:[[TOPIC.curveBuy,TOPIC.curveSell]]},{address:this.config.manager,topics:[TOPIC.swapV4,this.config.poolId]},{address:this.config.token,topics:[BURN_TRANSFER,null,'0x'+'0'.repeat(64)]}];
  const byBlock=new Map<number,any[]>();
  let count=0;
  for(const filter of filters){
   const logs=await this.rpc('eth_getLogs',[{...filter,fromBlock:blockTag(anchor.number+1),toBlock:blockTag(end)}]);
   if(!Array.isArray(logs)||logs.length>2000)throw Error('Invalid logs response');
   for(const l of logs){
    const n=quantity(l.blockNumber);if(n<=anchor.number||n>end)throw Error('Log outside requested range');
    if(l.address!==filter.address)throw Error('Wrong log emitter');
    const list=byBlock.get(n)??[];list.push(l);byBlock.set(n,list);if(++count>2000)throw Error('Market batch event limit');
   }
  }
  const dense=byBlock.size>(end-anchor.number)/2;
  const needed=dense?Array.from({length:end-anchor.number},(_,i)=>anchor.number+1+i):[...byBlock.keys()];
  for(const n of needed.sort((a,b)=>a-b)){
   if(!headers.has(n))headers.set(n,header(await this.rpc('eth_getBlockByNumber',[blockTag(n),false]),n));
   for(const l of byBlock.get(n)??[])logBase(l,headers.get(n)!);
  }
  const batch:{block:import('./trade-ledger.js').MarketBlock;quote:HistoricalQuote|null}[]=[];
  const quotes=new Map<number,HistoricalQuote|null>();let previous=anchor;
  let trades=0;
  for(const number of [...headers.keys()].sort((a,b)=>a-b)){
   const b=headers.get(number)!;
   if((number===previous.number+1&&b.parentHash!==previous.hash)||b.timestamp<previous.timestamp)throw Error('Noncontiguous RPC headers');
   previous=b;
   const all=byBlock.get(number)??[];
   if(all.length>1000||new Set(all.map(l=>l.logIndex)).size!==all.length)throw Error('Duplicate or excessive logs');
   const events:MarketEvent[]=[];const burns:import('./trade-ledger.js').BurnEvent[]=[];
   for(const l of all){
    if(l.address===this.config.token){
     if(l.topics.length!==3||l.topics[0]!==BURN_TRANSFER||l.topics[2]!=='0x'+'0'.repeat(64)||!/^0x[0-9a-f]{64}$/.test(l.data))throw Error('Malformed burn');
     const from=topicAddress(l.topics[1]),units=uint(l.data,0);if(from===ZERO)throw Error('Invalid burn sender');
     if(units>0n)burns.push({chainId:this.config.chainId,token:this.config.token,hash:l.transactionHash,logIndex:quantity(l.logIndex),timestamp:b.timestamp,from,units:units.toString()});
     continue;
    }
    let eth:bigint,side:'buy'|'sell',trader:string,venue:'curve'|'pool';
    if(l.address===this.config.curve){
     if(l.topics.length!==3||![TOPIC.curveBuy,TOPIC.curveSell].includes(l.topics[0])||!/^0x[0-9a-f]{256}$/.test(l.data))throw Error('Malformed curve trade');
     trader=topicAddress(l.topics[1]);topicAddress(l.topics[2]);side=l.topics[0]===TOPIC.curveBuy?'buy':'sell';eth=uint(l.data,side==='buy'?0:1);venue='curve';
    }else{
     if(l.topics.length!==3||l.topics[0]!==TOPIC.swapV4||l.topics[1]!==this.config.poolId||!/^0x[0-9a-f]{384}$/.test(l.data))throw Error('Malformed pool trade');
     topicAddress(l.topics[2]);const quote=signed(l.data,0),token=signed(l.data,1);
     if(quote===0n||token===0n)continue;
     if((quote>0n)===(token>0n))throw Error('Invalid pool trade signs');
     side=token>0n?'buy':'sell';eth=quote<0n?-quote:quote;venue='pool';
     const tx=await this.rpc('eth_getTransactionByHash',[l.transactionHash]);
     if(!tx||tx.hash!==l.transactionHash||tx.blockHash!==b.hash||quantity(tx.blockNumber)!==number||!isAddress(tx.from))throw Error('Transaction membership mismatch');
     trader=tx.from; // Transaction origin; may be a relayer, not a beneficial owner.
    }
    events.push({chainId:this.config.chainId,token:this.config.token,hash:l.transactionHash,logIndex:quantity(l.logIndex),timestamp:b.timestamp,ethWei:eth.toString(),side,venue,trader});
   }
   let quote:HistoricalQuote|null=null;
   if(events.length){
    const bucket=Math.floor(b.timestamp/60000);
    if(!quotes.has(bucket)){
     try{quotes.set(bucket,await this.prices.quote(b.timestamp));}catch{quotes.set(bucket,null);}
    }
    quote=quotes.get(bucket)??null;
   }
   batch.push({block:{...b,events,burns},quote});trades+=events.length;
  }
  // Check each used event header again; mixed-branch RPC responses cannot commit.
  // This relies on a consistent canonical RPC, just as log completeness does.
  for(const [number,b] of dense?[[end,headers.get(end)!] as const]:headers){
   const checked=header(await this.rpc('eth_getBlockByNumber',[blockTag(number),false]),number);
   if(checked.hash!==b.hash)throw Error('Block changed during collection');
  }
  await this.anchor();
  const result=await this.ledger.ingestScannedRange(anchor,end,batch);
  return {accepted:result.duplicate?0:end-anchor.number,trades:result.duplicate?0:trades,through:end,lagBlocks:Math.max(0,safe-end)};
 }

 async retryPrices(limit=10){
  if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid quote retry budget');
  const rows=(await this.ledger.service.pool.query("SELECT identity,raw FROM colony_trades WHERE status='pending' ORDER BY block_number,log_index LIMIT $1",[limit])).rows;
  let resolved=0;
  for(const row of rows){const quote=await this.prices.quote(row.raw.timestamp);if(!quote)break;await this.ledger.resolve(row.identity,quote);resolved++;}
  return {resolved,pending:rows.length-resolved};
 }
}
