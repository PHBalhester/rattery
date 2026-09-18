import type {Req,Res} from './_lib/eth.js';
/** Only the server-configured Railway observer is contacted; no browser-supplied URL. */
export default async function handler(req:Req,res:Res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET required'});}
 const production=process.env.RATTERY_PUBLIC_COLONY==='production';
 if((!production&&process.env.VITE_STAGING!=='true')||process.env.RATTERY_OBSERVER_ENABLED!=='true')return res.status(503).json({error:'Shared colony unavailable'});
 try{
  const url=new URL(process.env.RATTERY_OBSERVER_URL??''),secret=process.env.RATTERY_OBSERVER_SECRET??'';
  if(url.protocol!=='https:'||!url.hostname.endsWith('.up.railway.app')||url.username||url.password||url.search||url.hash||url.pathname!=='/snapshot'||! /^[a-f0-9]{64}$/.test(secret))throw Error('Invalid observer config');
  const response=await fetch(url,{headers:{Authorization:'Bearer '+secret},redirect:'error',signal:AbortSignal.timeout(6000)});
  if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error('Observer unavailable');
  const reader=response.body?.getReader();if(!reader)throw Error('Empty response');let length=0;const parts:Uint8Array[]=[];
  for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>4*1024*1024){await reader.cancel();throw Error('Size limit');}parts.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  const snapshot=JSON.parse(new TextDecoder().decode(bytes));
  if(snapshot.protocol!==1||snapshot.colonyId!==(production?'rattery-production-v1':'rattery-staging-market-v1')||snapshot.paymentsEnabled!==production||!Number.isSafeInteger(snapshot.revision)||!Number.isFinite(snapshot.at)||!snapshot.world?.rats||snapshot.world.care||snapshot.world.demoToken)throw Error('Invalid observation');
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=1, must-revalidate');return res.status(200).json(snapshot);
 }catch{return res.status(503).json({error:'Shared colony temporarily unavailable'});}
}
