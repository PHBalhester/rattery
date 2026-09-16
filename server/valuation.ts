// Used by the shared server ledger; existing browser fixed-price replay is unchanged.
export interface HistoricalQuote{source:string;observedAt:number;usdMicrosPerEth:string;}
export interface HistoricalTrade{chainId:number;token:string;hash:string;logIndex:number;timestamp:number;ethWei:string;}
export function historicalValuation(trade:HistoricalTrade,quote:HistoricalQuote|null,allowedSources:ReadonlySet<string>){
 if(![4663,46630].includes(trade.chainId)||!/^0x[0-9a-f]{40}$/.test(trade.token)||!/^0x[0-9a-f]{64}$/.test(trade.hash)||!Number.isSafeInteger(trade.logIndex)||trade.logIndex<0||!Number.isSafeInteger(trade.timestamp)||trade.timestamp<=0||! /^(0|[1-9][0-9]{0,77})$/.test(trade.ethWei))throw Error('Invalid trade');
 const identity=trade.chainId+':'+trade.token+':'+trade.hash+':'+trade.logIndex;
 if(!quote)return {version:'historical-usd-v1' as const,identity,status:'pending' as const};
 if(!allowedSources.has(quote.source)||!Number.isSafeInteger(quote.observedAt)||quote.observedAt>trade.timestamp||trade.timestamp-quote.observedAt>300000||! /^[1-9][0-9]{0,17}$/.test(quote.usdMicrosPerEth))throw Error('Invalid historical quote');
 const micros=BigInt(trade.ethWei)*BigInt(quote.usdMicrosPerEth)/10n**18n;
 const tier=micros<50_000_000n?'light':micros<250_000_000n?'small':micros<500_000_000n?'medium':micros<1_000_000_000n?'large':'giant';
 return {version:'historical-usd-v1' as const,identity,status:'classified' as const,usdMicros:micros.toString(),tier,quote:{...quote},trade:{...trade}};
}
