import {SeasonEvents} from './season-events.js';
import {Contract,JsonRpcProvider,Wallet,keccak256,id,Interface} from 'ethers';
import type {Pool} from 'pg';
import {StagingAuth} from './auth.js';
import {ratteryQuotePrice,usdBurnUnits} from './season-price.js';
import {SEASON_QUOTE_TYPES,seasonQuoteDomain,seasonQuoteHash,type SeasonQuote,type SeasonBurnConfig} from '../src/market/seasonBurn.js';
import {verifySeasonBurn} from '../api/_lib/seasonBurn.js';
import type {ReadRPC} from '../api/_lib/seasonStocks.js';
export const SEASON_OPEN=Date.parse('2026-09-28T16:00:00Z')/1000,SEASON_CLOSE=Date.parse('2026-10-05T03:00:00Z')/1000;
export const SEASON_ID=id('RATTERY-SEASON-1-2026-09-28');
export const SEASON_ABI=['function token() view returns(address)','function quoteSigner() view returns(address)','function operator() view returns(address)','function season() view returns(bytes32)','function opensAt() view returns(uint64)','function closesAt() view returns(uint64)','function honorEntryQuote() view returns(bool)','function paused() view returns(bool)','function colonySlot() view returns(uint32)','function members(address) view returns(uint256 id,uint8 nest)','function nonces(address) view returns(uint256)','function contributions(uint256) view returns(uint256)','function nests(uint8) view returns(uint256 score,uint256 gross,uint64 lastProduction,uint64 shieldUntil,uint64 shieldReady,uint64 attackReady,uint8 halfPoint)','function applyColonyPoints(uint32 slot,int8[3] deltas)'];
export const serial=(v:unknown)=>JSON.parse(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x));
const tokenABI=new Interface(['function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)']);
export class SeasonService{
 readonly events:SeasonEvents;readonly provider:JsonRpcProvider;readonly signer:Wallet;readonly router:Contract;readonly config:SeasonBurnConfig;
 constructor(readonly pool:Pool,readonly auth:StagingAuth,readonly read:ReadRPC,readonly routerAddress:string,readonly runtimeHash:string,rpcURL:string,key:string,readonly clock=Date.now){
  if(!/^0x[0-9a-fA-F]{40}$/.test(routerAddress)||!/^0x[0-9a-fA-F]{64}$/.test(runtimeHash))throw Error('Season configuration required');
  this.events=new SeasonEvents(read,routerAddress,clock);this.provider=new JsonRpcProvider(rpcURL,4663,{staticNetwork:true});this.signer=new Wallet(key,this.provider);this.router=new Contract(routerAddress,SEASON_ABI,this.provider);
  this.config={chainId:4663,router:routerAddress,token:'0xc322305e79337300b59ff48389f8c9a1d9e0de76',quoteSigner:this.signer.address};
 }
 async initialize(){
  if(Number(await this.read('eth_chainId',[]))!==4663||keccak256(await this.read('eth_getCode',[this.routerAddress,'latest']))!==this.runtimeHash)throw Error('Unverified Season router');
  const [token,signer,operator,season,open,close,honor]=await Promise.all([this.router.token(),this.router.quoteSigner(),this.router.operator(),this.router.season(),this.router.opensAt(),this.router.closesAt(),this.router.honorEntryQuote()]);
  if(token.toLowerCase()!==this.config.token||signer.toLowerCase()!==this.signer.address.toLowerCase()||operator.toLowerCase()!=='0xd40ed0214353b746fd567fa4a57409d1b5709988'||season!==SEASON_ID||Number(open)!==SEASON_OPEN||Number(close)!==SEASON_CLOSE||!honor)throw Error('Season router parameters mismatch');
  await this.pool.query('SELECT slot FROM season_colony_ticks LIMIT 1');
 }
 async overview(session:string){
  let wallet:string|null=null;try{wallet=await this.auth.wallet(session);}catch{}
  const now=Number((await this.read('eth_getBlockByNumber',['latest',false])).timestamp);if(Math.abs(this.clock()/1000-now)>60)throw Error('Chain unavailable');
  const [paused,slot,...rows]=await Promise.all([this.router.paused(),this.router.colonySlot(),...[1,2,3].map(n=>this.router.nests(n))]);
  const expected=Math.floor((Math.min(now,SEASON_CLOSE)-SEASON_OPEN)/600),phase=now<SEASON_OPEN?'scheduled':now>=SEASON_CLOSE?'closed':paused?'paused':Number(slot)!==expected?'updating':'open';
  const member=wallet?await this.router.members(wallet):null;
  return {protocol:1,events:await this.events.get(),phase,serverAt:now*1000,opensAt:SEASON_OPEN*1000,closesAt:SEASON_CLOSE*1000,switchClosesAt:(SEASON_CLOSE-18000)*1000,config:this.config,runtimeHash:this.runtimeHash,wallet,
   member:member?{id:String(member.id),nest:Number(member.nest),contribution:String(await this.router.contributions(member.id))}:null,
   nests:rows.map((n,i)=>({id:i+1,ticker:['NVDA','AAPL','AMZN'][i],score:String(n.score),halfPoint:Number(n.halfPoint),gross:String(n.gross),shieldUntil:Number(n.shieldUntil)*1000,shieldReady:Number(n.shieldReady)*1000,attackReady:Number(n.attackReady)*1000})),colonySlot:Number(slot)};
 }
 async funding(wallet:string,tag='latest'){const call=async(name:string,args:string[])=>tokenABI.decodeFunctionResult(name,await this.read('eth_call',[{to:this.config.token,data:tokenABI.encodeFunctionData(name,args)},tag]))[0] as bigint;const [balance,allowance]=await Promise.all([call('balanceOf',[wallet]),call('allowance',[wallet,this.routerAddress])]);return {balance:String(balance),allowance:String(allowance)};}
 async quote(session:string,kind:number,nest:number){
  const wallet=await this.auth.wallet(session);if(!Number.isInteger(kind)||kind<0||kind>3||!Number.isInteger(nest)||nest<1||nest>3)throw Error('Invalid action');
  const state=await this.overview(session),now=Math.floor(state.serverAt/1000);if(state.phase!=='open')throw Error('Season not open');
  const member=state.member!;if(kind===0&&member.id!=='0'&&(member.nest===nest||now>=SEASON_CLOSE-18000)||kind!==0&&(member.id==='0'||(kind===3?member.nest===nest:member.nest!==nest)))throw Error('Action unavailable');
  const own=state.nests[member.nest-1];if(kind===2&&(own.shieldReady>state.serverAt||own.shieldUntil>state.serverAt)||kind===3&&own.attackReady>state.serverAt)throw Error('Cooldown active');
  const remaining=SEASON_CLOSE-now,cents=kind===0?(remaining>259200?1000:remaining>129600?1500:remaining>43200?2000:3000):[0,200,1000,2000][kind];
  const expires=Math.min(now+60,SEASON_CLOSE,SEASON_OPEN+(state.colonySlot+1)*600,kind===0&&member.id!=='0'?SEASON_CLOSE-18000:SEASON_CLOSE);if(expires-now<15)throw Error('Score update pending; try again shortly');
  const price=await ratteryQuotePrice(this.read,this.clock),q:SeasonQuote={season:SEASON_ID,wallet,nonce:await this.router.nonces(wallet),membership:BigInt(member.id),kind,nest,amount:usdBurnUnits(BigInt(cents),price.usdWad),usdCents:BigInt(cents),issuedAt:BigInt(now),expiresAt:BigInt(expires)};
  const signature=await this.signer.signTypedData(seasonQuoteDomain(this.config),SEASON_QUOTE_TYPES,q),hash=seasonQuoteHash(this.config,q);
  await this.pool.query('INSERT INTO season_quotes(quote_hash,wallet,nonce,quote,signature,price) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[hash,wallet,String(q.nonce),serial(q),signature,serial(price)]);
  return {config:this.config,quote:serial(q),signature,quoteHash:hash,runtimeHash:this.runtimeHash,price:serial(price),funding:await this.funding(wallet)};
 }
 async finalize(session:string,quoteHash:string,hash:string){
  const wallet=await this.auth.wallet(session);if(!/^0x[0-9a-fA-F]{64}$/.test(quoteHash)||!/^0x[0-9a-fA-F]{64}$/.test(hash))throw Error('Invalid receipt');
  const row=(await this.pool.query('SELECT * FROM season_quotes WHERE quote_hash=$1 AND wallet=$2',[quoteHash,wallet])).rows[0];if(!row)throw Error('Unknown quote');
  const q={...row.quote};for(const k of ['nonce','membership','amount','usdCents','issuedAt','expiresAt'])q[k]=BigInt(q[k]);
  let receipt;
  try{receipt=await verifySeasonBurn(this.read,hash,{config:this.config,quote:q,signature:row.signature,routerCodeHash:this.runtimeHash});}
  catch(error){const message=(error as Error).message;
   if(message==='Season burn pending'||message==='Season burn not confirmed')return {confirmed:false,status:message==='Season burn pending'?'pending':'confirming'};
   if(message==='Season action reverted'){
    const failed=await this.read('eth_getTransactionReceipt',[hash]),block=await this.read('eth_getBlockByNumber',[failed.blockNumber,false]),funding=await this.funding(wallet,failed.blockNumber);
    const reason=BigInt(funding.balance)<q.amount?'INSUFFICIENT_RATTERY':BigInt(funding.allowance)<q.amount?'APPROVAL_REQUIRED':BigInt(block.timestamp)>=q.expiresAt?'QUOTE_EXPIRED':'REVERTED';
    return {confirmed:false,status:'reverted',reason,...funding,required:String(q.amount)};
   }
   throw error;
  }
  await this.pool.query('INSERT INTO season_actions(event_key,tx_hash,wallet,block_number,block_hash,receipt) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(event_key) DO NOTHING',[receipt.key,receipt.hash,wallet,receipt.block,receipt.blockHash,receipt]);return {confirmed:true,receipt};
 }
}
