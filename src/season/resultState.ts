import {useEffect,useState} from 'react';
import {create} from 'zustand';
import {useSeasonVisual,type NestId} from './visualState';
import {publishFinalNests} from './liveVisuals';
export const SEASON_CLOSE=1791169200000;
export type FinalRow={nest:number;ticker:NestId;baseHalves:string;weeklyAdjustment:string;finalHalves:string;gross:string};
export type SeasonResult={protocol:1;season:string;phase:'scheduled'|'open'|'awaiting'|'complete';serverAt:number;closesAt:number;winner:NestId|null;reason:string|null;ranking:FinalRow[];resultId?:string;block:number;blockHash:string;confirmedCheckpoints:number;requiredCheckpoints:number};
export const useSeasonResult=create<{result:SeasonResult|null;offset:number;available:boolean;dialog:boolean}>(()=>({result:null,offset:0,available:false,dialog:false}));
export function useSeasonClosed(){const offset=useSeasonResult(s=>s.offset),phase=useSeasonResult(s=>s.result?.phase);const [now,setNow]=useState(Date.now());useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);return phase==='awaiting'||phase==='complete'||now+offset>=SEASON_CLOSE;}
let busy=false;
export async function refreshSeasonResult(){
 if(busy)return;busy=true;
 try{
  const response=await fetch('/api/season-result',{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Unavailable');
  const r:SeasonResult=await response.json();
  if(r.protocol!==1||r.season!=='RATTERY-SEASON-1-2026-09-28'||r.closesAt!==SEASON_CLOSE||!Number.isFinite(r.serverAt)||!['scheduled','open','awaiting','complete'].includes(r.phase))throw Error('Unexpected result');
  if(r.phase==='complete'){
   if(!/^0x[0-9a-f]{64}$/i.test(r.resultId??'')||r.confirmedCheckpoints!==930||r.ranking.length!==3||new Set(r.ranking.map(x=>x.ticker)).size!==3||r.ranking.some(x=>!['NVDA','AAPL','AMZN'].includes(x.ticker)||!/^\d+$/.test(x.finalHalves)||!Number.isSafeInteger(Number(x.finalHalves)))||r.winner!==r.ranking[0].ticker)throw Error('Invalid final standings');
   const first=useSeasonResult.getState().result?.phase!=='complete';
   publishFinalNests(r.ranking,r.winner!);
   if(first){let seen=false;try{seen=sessionStorage.getItem('season-finale:'+r.season)===r.resultId;sessionStorage.setItem('season-finale:'+r.season,r.resultId!);}catch{/* Still reveal once in this page. */}
    if(!seen){useSeasonVisual.getState().focusNest(r.winner!);
     // Let the camera, crown and fireworks finish before covering the scene.
     const delay=matchMedia('(prefers-reduced-motion: reduce)').matches?0:7000;
     window.setTimeout(()=>{if(useSeasonResult.getState().result?.resultId===r.resultId)useSeasonResult.setState({dialog:true});},delay);
    }
   }
  }
  useSeasonResult.setState({result:r,offset:r.serverAt-Date.now(),available:true});
 }catch{useSeasonResult.setState({available:false});}finally{busy=false;}
}
