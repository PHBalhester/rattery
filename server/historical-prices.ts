import type {Pool} from 'pg';
import type {HistoricalQuote} from './valuation.js';
import {boundedJSON} from './market-io.js';
export const PRICE_SOURCE='coinbase:ETH-USD:previous-minute-close:v1';
export class HistoricalPrices{
 constructor(readonly pool:Pool,readonly fetcher:typeof fetch=fetch){}
 async quote(timestamp:number):Promise<HistoricalQuote|null>{
  if(!Number.isSafeInteger(timestamp)||timestamp<60000)throw Error('Invalid quote timestamp');
  const end=Math.floor(timestamp/60000)*60000;
  const cached=(await this.pool.query('SELECT quote FROM market_quotes WHERE source=$1 AND bucket_end=$2',[PRICE_SOURCE,end])).rows[0];
  if(cached)return cached.quote;
  const url=new URL('https://api.exchange.coinbase.com/products/ETH-USD/candles');
  url.searchParams.set('granularity','60');
  url.searchParams.set('start',new Date(end-60000).toISOString());url.searchParams.set('end',new Date(end).toISOString());
  const data=await boundedJSON(url.href,{},100_000,this.fetcher);
  if(!Array.isArray(data)||data.length>300)throw Error('Invalid candle response');
  const rows=data.filter(r=>Array.isArray(r)&&r[0]===(end-60000)/1000);
  if(!rows.length)return null;
  if(rows.length!==1)throw Error('Duplicate candle');
  const row=rows[0];
  if(row.length!==6||!row.every((n:unknown)=>typeof n==='number'&&Number.isFinite(n))||row[1]<=0||row[2]<row[1]||row[3]<row[1]||row[3]>row[2]||row[4]<row[1]||row[4]>row[2]||row[5]<0)throw Error('Invalid candle');
  // API prices are JSON numbers. Pin rounding to six decimal places once,
  // then use integer arithmetic for every trade valuation.
  const micros=Math.round(row[4]*1e6);
  if(!Number.isSafeInteger(micros)||micros<=0)throw Error('Invalid ETH price');
  const quote:HistoricalQuote={source:PRICE_SOURCE,observedAt:end,usdMicrosPerEth:String(micros)};
  await this.pool.query('INSERT INTO market_quotes(source,bucket_end,quote) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[PRICE_SOURCE,end,quote]);
  // Competing collectors always consume the first committed quote.
  return (await this.pool.query('SELECT quote FROM market_quotes WHERE source=$1 AND bucket_end=$2',[PRICE_SOURCE,end])).rows[0].quote;
 }
}
