import {create} from 'zustand';

// Local design rehearsal only. Never reads/writes the engine, wallet or payment ledger.
export const seasonPreviewEnabled=import.meta.env.DEV&&new URLSearchParams(location.search).has('season-preview');
export const NEST_DESIGNS=[
 {id:'NVDA',company:'NVIDIA',color:'#91cf36',dark:'#273a18',anchor:[.12,.13],letter:'A'},
 {id:'AAPL',company:'Apple',color:'#dce6f0',dark:'#354452',anchor:[.105,.78],letter:'B'},
 {id:'AMZN',company:'Amazon',color:'#ffae43',dark:'#573713',anchor:[.87,.15],letter:'C'},
] as const;
export type NestId=typeof NEST_DESIGNS[number]['id'];
export const VISUAL_TIERS=[0,250,1000,3000] as const;
export const TIER_NAMES=['Bedding','Shelter','Haven','Crowned lodge'] as const;
export function visualTier(score:number){return Number(score>=250)+Number(score>=1000)+Number(score>=3000);}
export type VisualEvent={serial:number;nest:NestId;kind:'feed'|'shield'|'attack';points?:number;damage?:number;blocked?:boolean};
/** Preview-only numbers so the scene can show gains and losses. Not Season rules. */
export const DEMO_DELTA={feed:20,attack:-40} as const;
type VisualState={focus:NestId|null;focusNest:(id:NestId|null)=>void;hover:NestId|null;setHover:(id:NestId|null)=>void;scores:Record<NestId,number>;event:VisualEvent|null;winner:NestId|null;reveal:number;shieldUntil:Record<NestId,number>;
 setScore:(id:NestId,score:number)=>void;play:(id:NestId,kind:VisualEvent['kind'])=>void;revealWinner:(id:NestId)=>void;reset:()=>void};
const zero=()=>({NVDA:0,AAPL:0,AMZN:0});
export const useSeasonVisual=create<VisualState>(set=>({focus:null,focusNest:focus=>set({focus}),hover:null,setHover:hover=>set({hover}),scores:zero(),event:null,winner:null,reveal:0,shieldUntil:zero(),
 setScore:(id,score)=>{if(Number.isFinite(score))set(s=>({scores:{...s.scores,[id]:Math.max(0,score)}}));},
 play:(nest,kind)=>{if(!seasonPreviewEnabled)return;set(s=>{const now=performance.now(),event={serial:(s.event?.serial??0)+1,nest,kind};
  if(kind==='shield')return {event,shieldUntil:{...s.shieldUntil,[nest]:now+3600}};
  // The attack lands when the snake reaches the nest, so the score drops a little later in the scene.
  const delta=kind==='feed'?DEMO_DELTA.feed:kind==='attack'&&s.shieldUntil[nest]<now+2500?DEMO_DELTA.attack:0;
  return {event,scores:{...s.scores,[nest]:Math.max(0,s.scores[nest]+delta)}};});},
 revealWinner:winner=>set(s=>s.winner===winner?{}:{winner,reveal:s.reveal+1}),
 reset:()=>set(s=>({focus:null,hover:null,scores:zero(),event:null,winner:null,reveal:s.reveal+1,shieldUntil:zero()})),
}));
