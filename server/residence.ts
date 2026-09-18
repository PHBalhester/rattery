import {id} from 'ethers';
import type {Pool} from 'pg';
import type {ReadRPC} from './market-io.js';
import {HistoricalPrices} from './historical-prices.js';
const TOKEN='0xc322305e79337300b59ff48389f8c9a1d9e0de76',CURVE='0x0f5d652f31b1221db5cd71f8b0fe4b9bf3b4736b';
const DAY=86400000;
export function residenceTier(ms:number){return ms>=90*DAY?90:ms>=30*DAY?30:ms>=7*DAY?7:0;}
export function residenceProgress(previous:{verified_ms:string|number;checked_at:string|number;eligible:boolean},at:number,qualifies:boolean){
 const gap=at-Number(previous.checked_at);
 return qualifies?Number(previous.verified_ms)+(previous.eligible&&gap>0&&gap<=120000?gap:0):0;
}
export class ResidenceWorker{
 constructor(readonly pool:Pool,readonly rpc:ReadRPC,readonly prices=new HistoricalPrices(pool)){}
 async poll(){
  await this.pool.query("INSERT INTO holder_residence(wallet) SELECT wallet FROM residence_wallets UNION SELECT wallet FROM rat_ownership UNION SELECT wallet FROM care_intents ON CONFLICT DO NOTHING");
  const wallets=(await this.pool.query('SELECT * FROM holder_residence ORDER BY checked_at,wallet LIMIT 100')).rows;
  if(!wallets.length)return {checked:0};
  try{
   if(Number(await this.rpc('eth_chainId',[]))!==4663)throw Error('Wrong chain');
   const head=Number(BigInt(await this.rpc('eth_blockNumber',[])))-20,tag='0x'+head.toString(16);
   const block=await this.rpc('eth_getBlockByNumber',[tag,false]);
   if(!block||Number(BigInt(block.number))!==head||!/^0x[0-9a-f]{64}$/.test(block.hash))throw Error('Invalid block');
   const at=Number(BigInt(block.timestamp))*1000;
   if(Math.abs(Date.now()-at)>120000)throw Error('Stale chain');
   const call=(to:string,data:string)=>this.rpc('eth_call',[{to,data},tag]);
   // The curve quote is invalid after graduation; fail closed until a pool adapter is enabled.
   const graduated=await call(CURVE,id('graduated()').slice(0,10));if(BigInt(graduated)!==0n)throw Error('Pool valuation pending');
   const reserves=await call(CURVE,id('getReserves()').slice(0,10));if(!/^0x[0-9a-f]{128}$/i.test(reserves))throw Error('Invalid reserves');
   const quoteReserve=BigInt('0x'+reserves.slice(2,66)),tokenReserve=BigInt('0x'+reserves.slice(66));
   const quote=await this.prices.quote(at);if(!quote||at-quote.observedAt>120000||quoteReserve<=0n||tokenReserve<=0n)throw Error('Price unavailable');
   let checked=0;
   for(const row of wallets){
    if(Number(row.block_number)>=head)continue;
    try{
     if(row.block_hash){const prior=await this.rpc('eth_getBlockByNumber',['0x'+Number(row.block_number).toString(16),false]);if(prior?.hash!==row.block_hash)throw Error('Reorganization');}
     const raw=await call(TOKEN,'0x70a08231'+row.wallet.slice(2).padStart(64,'0'));if(!/^0x[0-9a-f]{64}$/i.test(raw))throw Error('Invalid balance');
     const balance=BigInt(raw),value=balance*quoteReserve*BigInt(quote.usdMicrosPerEth)/tokenReserve/10n**18n;
     const eligible=value>=100000000n,ms=residenceProgress(row,at,eligible);
     const evidence={version:'residence-usd-v1',block:head,hash:block.hash,at,balance:balance.toString(),usdMicros:value.toString(),quoteReserve:quoteReserve.toString(),tokenReserve:tokenReserve.toString(),quote};
     // Reconstruct every token transfer in the credited interval, including sends,
     // receipts, self-transfers and burns. A dip cannot be hidden by buying back.
     let credited=ms;
     if(row.eligible&&eligible&&Number(row.block_number)>0&&at-Number(row.checked_at)<=120000){
      const logs=await this.rpc('eth_getLogs',[{address:TOKEN,fromBlock:'0x'+(Number(row.block_number)+1).toString(16),toBlock:tag,topics:[id('Transfer(address,address,uint256)')]}]);
      if(!Array.isArray(logs))throw Error('Invalid transfers');
      logs.sort((a:any,b:any)=>Number(BigInt(a.blockNumber)-BigInt(b.blockNumber))||Number(BigInt(a.logIndex)-BigInt(b.logIndex)));
      let running=BigInt(row.balance_units),dipped=false;
      for(const l of logs){
       if(l.removed||l.address.toLowerCase()!==TOKEN||l.topics?.length!==3||!/^0x[0-9a-f]{64}$/i.test(l.data))throw Error('Invalid transfer');
       const amount=BigInt(l.data),from='0x'+l.topics[1].slice(-40).toLowerCase(),to='0x'+l.topics[2].slice(-40).toLowerCase();
       if(from===row.wallet)running-=amount;if(to===row.wallet)running+=amount;
       if(running<0n)throw Error('Balance history mismatch');
       if(running*quoteReserve*BigInt(quote.usdMicrosPerEth)/tokenReserve/10n**18n<100000000n)dipped=true;
      }
      if(running!==balance)throw Error('Balance history mismatch');
      if(dipped)credited=0;
     }
     const canonical=await this.rpc('eth_getBlockByNumber',[tag,false]);if(canonical?.hash!==block.hash)throw Error('Reorganization');
     const c=await this.pool.connect();try{await c.query('BEGIN');
      await c.query('UPDATE holder_residence SET verified_ms=$2,checked_at=$3,block_number=$4,block_hash=$5,balance_units=$6,value_micros=$7,eligible=$8,status=$9,evidence=$10 WHERE wallet=$1',[row.wallet,credited,at,head,block.hash,balance.toString(),value.toString(),eligible,eligible?'eligible':'below-threshold',evidence]);
      if(row.eligible!==eligible||residenceTier(Number(row.verified_ms))!==residenceTier(credited))await c.query('INSERT INTO holder_residence_history(wallet,recorded_at,kind,evidence) VALUES($1,$2,$3,$4)',[row.wallet,at,!eligible?'reset':residenceTier(credited)?'milestone':'qualified',evidence]);
      await c.query('COMMIT');checked++;
     }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
    }catch{await this.pool.query("UPDATE holder_residence SET eligible=false,status='pending' WHERE wallet=$1",[row.wallet]);}
   }
   return {checked};
  }catch{await this.pool.query("UPDATE holder_residence SET eligible=false,status='pending'");return {checked:0,pending:true};}
 }
}
