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
export type VisualEvent={serial:number;nest:NestId;kind:'feed'|'shield'|'attack'};
type VisualState={focus:NestId|null;focusNest:(id:NestId|null)=>void;scores:Record<NestId,number>;event:VisualEvent|null;winner:NestId|null;reveal:number;
 setScore:(id:NestId,score:number)=>void;play:(id:NestId,kind:VisualEvent['kind'])=>void;revealWinner:(id:NestId)=>void;reset:()=>void};
const zero=()=>({NVDA:0,AAPL:0,AMZN:0});
export const useSeasonVisual=create<VisualState>(set=>({focus:null,focusNest:focus=>set({focus}),scores:zero(),event:null,winner:null,reveal:0,
 setScore:(id,score)=>{if(Number.isFinite(score))set(s=>({scores:{...s.scores,[id]:Math.max(0,score)}}));},
 play:(nest,kind)=>set(s=>({event:{serial:(s.event?.serial??0)+1,nest,kind},scores:kind==='feed'?{...s.scores,[nest]:s.scores[nest]+20}:s.scores})),
 revealWinner:winner=>set(s=>s.winner===winner?{}:{winner,reveal:s.reveal+1}),
 reset:()=>set(s=>({focus:null,scores:zero(),event:null,winner:null,reveal:s.reveal+1})),
}));