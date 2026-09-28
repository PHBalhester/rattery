import {Interface,toQuantity,keccak256} from 'ethers';
import {STOCKS,parseRound} from '../api/_lib/seasonStocks.js';
import {SeasonService,SEASON_OPEN,SEASON_CLOSE,SEASON_ID,serial} from './season-service.js';
const abi=new Interface(['function latestRoundData() view returns(uint80,int256,uint256,uint256,uint80)','function decimals() view returns(uint8)','function oraclePaused() view returns(bool)']);
export function colonyHalves(stress:number,direction:-1|0|1){if(!Number.isFinite(stress)||stress<0||stress>1)throw Error('Invalid stress');return stress<.3?(direction===1?4:direction===-1?1:2):stress<.45?0:(direction===1?-1:direction===-1?-4:-2);}
export function seasonStress(world:any){const rats=Object.values(world.rats??{}).filter((r:any)=>r.deadAt===null) as any[];if(!rats.length)throw Error('No living colony observation');const stress=rats.reduce((s,r)=>s+(r.wellbeing?Math.max(0,Math.min(1,r.wellbeing.acute*.7+r.wellbeing.chronic*.3)):world.env.stress),0)/rats.length;return {stress,rats:rats.length};}
const refCache=new Map<number,string>();
async function dailyReference(s:SeasonService,time:number){
 // This immutable Season spans Sep 28–Oct 5, 2026: New York is UTC-4 throughout.
 // Previous weekday 16:00 New York; there are no US equity holidays during this Season.
 const d=new Date(time*1000);d.setUTCHours(20,0,0,0);d.setUTCDate(d.getUTCDate()-1);while([0,6].includes(d.getUTCDay()))d.setUTCDate(d.getUTCDate()-1);
 const target=d.getTime()/1000;if(refCache.has(target))return refCache.get(target)!;
 let lo=0,hi=Number(await s.read('eth_blockNumber',[]));while(lo<hi){const mid=Math.ceil((lo+hi)/2),b=await s.read('eth_getBlockByNumber',[toQuantity(mid),false]);if(Number(b.timestamp)<=target)lo=mid;else hi=mid-1;}const tag=toQuantity(lo);refCache.set(target,tag);return tag;
}
export async function observeColony(s:SeasonService,due:number){
 const row=(await s.pool.query('SELECT world,simulation_at,revision FROM colony_state WHERE id=1')).rows[0];
 if(!row||Math.abs(s.clock()-Number(row.simulation_at))>30000||Math.abs(Number(row.simulation_at)-due*1000)>60000)throw Error('Colony observation unavailable');
 const colony=seasonStress(row.world),date=new Date(due*1000),regular=date.getUTCDay()>0&&date.getUTCDay()<6&&(date.getUTCHours()*60+date.getUTCMinutes())>=810&&(date.getUTCHours()*60+date.getUTCMinutes())<1200;
 if(!regular)return {deltas:[0,0,0].map(()=>colonyHalves(colony.stress,0)),observation:{...colony,revision:String(row.revision),simulationAt:Number(row.simulation_at),market:'closed',quotes:[]}};
 const ref=await dailyReference(s,due),head=Number(await s.read('eth_blockNumber',[])),tag=toQuantity(head-20),block=await s.read('eth_getBlockByNumber',[tag,false]),refBlock=await s.read('eth_getBlockByNumber',[ref,false]);
 if(Math.abs(Number(block.timestamp)-due)>60)throw Error('Stock observation unavailable');
 const quotes=await Promise.all(STOCKS.map(async a=>{
  const call=async(name:string,at=tag,to:string=a.feed)=>abi.decodeFunctionResult(name,await s.read('eth_call',[{to,data:abi.encodeFunctionData(name)},at]));
  const [decimal,latest,previous,paused]=await Promise.all([call('decimals'),call('latestRoundData'),call('latestRoundData',ref),call('oraclePaused',tag,a.token)]);
  if(paused[0])throw Error('Stock oracle paused');
  const decimals=Number(decimal[0]);if(decimals>18||latest[1]<=0n||previous[1]<=0n||latest[3]<=0n||previous[3]<=0n||latest[3]>BigInt(Number(block.timestamp))||previous[3]>BigInt(Number(refBlock.timestamp))||BigInt(Number(block.timestamp))-latest[3]>86400n||BigInt(Number(refBlock.timestamp))-previous[3]>86400n||latest[4]<latest[0]||previous[4]<previous[0])throw Error('Stock reference unavailable');
  const direction=latest[1]>previous[1]?1:latest[1]<previous[1]?-1:0;
  return {ticker:a.symbol,decimals,current:String(latest[1]),previous:String(previous[1]),updatedAt:Number(latest[3]),referenceAt:Number(previous[3]),direction};
 }));
 return {deltas:quotes.map(q=>colonyHalves(colony.stress,q.direction as -1|0|1)),observation:{...colony,revision:String(row.revision),simulationAt:Number(row.simulation_at),block:head-20,blockHash:block.hash,referenceBlock:ref,market:'regular',quotes}};
}
export async function seasonWorkerStep(s:SeasonService){
 const c=await s.pool.connect();let locked=false;
 try{locked=(await c.query('SELECT pg_try_advisory_lock(9134663) AS locked')).rows[0].locked;if(!locked)return;
 const chain=await s.read('eth_getBlockByNumber',['latest',false]),now=Number(chain.timestamp);if(Math.abs(s.clock()/1000-now)>60)throw Error('Chain clock unavailable');
 const pending=(await c.query('SELECT slot,tx_hash FROM season_colony_ticks WHERE season=$1 AND confirmed=false AND tx_hash IS NOT NULL ORDER BY slot DESC LIMIT 3',[SEASON_ID])).rows;
 for(const item of pending){const receipt=await s.provider.getTransactionReceipt(item.tx_hash);if(receipt?.status===1&&Number(chain.number)-receipt.blockNumber>=20)await c.query('UPDATE season_colony_ticks SET confirmed=true WHERE season=$1 AND slot=$2',[SEASON_ID,item.slot]);}
 const slot=Number(await s.router.colonySlot())+1,due=SEASON_OPEN+slot*600;if(now<due||due>SEASON_CLOSE)return;
 let row=(await c.query('SELECT * FROM season_colony_ticks WHERE season=$1 AND slot=$2',[SEASON_ID,slot])).rows[0];
 if(!row){if(now-due>60)throw Error('Missed colony observation; manual reconciliation required');const observation=await observeColony(s,due);await c.query('INSERT INTO season_colony_ticks(season,slot,due_at,observation,deltas) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[SEASON_ID,slot,due*1000,observation.observation,JSON.stringify(observation.deltas)]);row=(await c.query('SELECT * FROM season_colony_ticks WHERE season=$1 AND slot=$2',[SEASON_ID,slot])).rows[0];}
 if(!row.raw_tx){const fees=await s.provider.getFeeData();if(!fees.maxFeePerGas||fees.maxFeePerGas>1000000000n)throw Error('Gas temporarily unavailable');const tx={chainId:4663,to:s.routerAddress,data:s.router.interface.encodeFunctionData('applyColonyPoints',[slot,row.deltas]),value:0n,nonce:await s.provider.getTransactionCount(s.signer.address,'pending'),gasLimit:200000n,maxFeePerGas:fees.maxFeePerGas,maxPriorityFeePerGas:fees.maxPriorityFeePerGas??0n,type:2};const raw=await s.signer.signTransaction(tx);await c.query('UPDATE season_colony_ticks SET raw_tx=$3,tx_hash=$4 WHERE season=$1 AND slot=$2',[SEASON_ID,slot,raw,keccak256(raw)]);row.raw_tx=raw;row.tx_hash=keccak256(raw);}
 const receipt=await s.provider.getTransactionReceipt(row.tx_hash);if(receipt){if(receipt.status!==1)throw Error('Colony update reverted');await c.query('UPDATE season_colony_ticks SET confirmed=true WHERE season=$1 AND slot=$2',[SEASON_ID,slot]);return;}
 // The identical signed transaction is persisted before broadcast, so a retry cannot apply a tick twice.
 await s.provider.broadcastTransaction(row.raw_tx);
 }finally{if(locked)await c.query('SELECT pg_advisory_unlock(9134663)').catch(()=>{});c.release();}
}
export function startSeasonWorker(s:SeasonService){let stopped=false,busy=false;const timer=setInterval(()=>{if(stopped||busy)return;busy=true;void seasonWorkerStep(s).catch(()=>console.error('Season checkpoint pending; details withheld')).finally(()=>{busy=false;});},5000);timer.unref();return()=>{stopped=true;clearInterval(timer);};}