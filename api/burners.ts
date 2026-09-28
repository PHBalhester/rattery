import type {Req,Res} from './_lib/eth.js';
/** Public top-burner leaderboard. Only the server-configured Railway observer is contacted; no browser-supplied URL. */
const NESTS=new Set(['NVDA','AAPL','AMZN']);
export default async function handler(req:Req,res:Res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET required'});}
 const production=process.env.RATTERY_PUBLIC_COLONY==='production';
 if((!production&&process.env.VITE_STAGING!=='true')||process.env.RATTERY_OBSERVER_ENABLED!=='true')return res.status(503).json({error:'Leaderboard unavailable'});
 try{
  const base=new URL(process.env.RATTERY_OBSERVER_URL??''),secret=process.env.RATTERY_OBSERVER_SECRET??'';
  if(base.protocol!=='https:'||!base.hostname.endsWith('.up.railway.app')||base.username||base.password||base.search||base.hash||base.pathname!=='/snapshot'||! /^[a-f0-9]{64}$/.test(secret))throw Error('Invalid observer config');
  const url=new URL('/burners',base);
  const response=await fetch(url,{headers:{Authorization:'Bearer '+secret},redirect:'error',signal:AbortSignal.timeout(6000)});
  if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error('Observer unavailable');
  const reader=response.body?.getReader();if(!reader)throw Error('Empty response');let length=0;const parts:Uint8Array[]=[];
  for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>65536){await reader.cancel();throw Error('Size limit');}parts.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  const data=JSON.parse(new TextDecoder().decode(bytes));
  const digits=(v:unknown)=>typeof v==='string'&&/^[0-9]{1,78}$/.test(v);
  if(data?.protocol!==1||data.kind!=='burners'||!digits(data.totalUnits)||!Number.isSafeInteger(data.burns)||!Number.isSafeInteger(data.wallets)||!Array.isArray(data.leaders)||data.leaders.length>100)throw Error('Invalid leaderboard');
  const leaders=data.leaders.map((r:any)=>{
   if(typeof r?.wallet!=='string'||!/^0x[0-9a-f]{40}$/.test(r.wallet)||!digits(r.units)||!Number.isSafeInteger(r.burns)||(r.nest!==null&&!NESTS.has(r.nest)))throw Error('Invalid row');
   return {wallet:r.wallet,units:r.units,burns:r.burns,nest:r.nest};
  });
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=30, stale-while-revalidate=60');
  return res.status(200).json({protocol:1,kind:'burners',chainId:Number.isSafeInteger(data.chainId)?data.chainId:null,at:Number.isFinite(data.at)?data.at:Date.now(),totalUnits:data.totalUnits,burns:data.burns,wallets:data.wallets,firstBlock:Number.isSafeInteger(data.firstBlock)?data.firstBlock:null,lastBlock:Number.isSafeInteger(data.lastBlock)?data.lastBlock:null,leaders});
 }catch{return res.status(503).json({error:'Leaderboard temporarily unavailable'});}
}
