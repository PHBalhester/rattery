import {create} from 'zustand';

/*
 * Season I market and prize data for the two Season windows.
 * Rules follow RATTERY-SEASON-1-WHITEPAPER v0.1 (beta). Presentation only: nothing here
 * scores, settles or pays. The authoritative numbers come from the settlement service.
 *
 * Integration: call publishSeasonFeed({source:'live',quotes,prize}) from the real feed.
 * Until then review builds run a clearly labelled demo feed and public builds show "pending".
 */

export type Ticker='NVDA'|'AAPL'|'AMZN';
export const TICKERS:{ticker:Ticker;company:string;color:string}[]=[
 {ticker:'NVDA',company:'NVIDIA',color:'#91cf36'},
 {ticker:'AAPL',company:'Apple',color:'#dce6f0'},
 {ticker:'AMZN',company:'Amazon',color:'#ffae43'},
];
/** last: latest regular-session price. prevClose: previous regular-session close. weekRef: Friday close before the week. */
export type Quote={last:number;prevClose:number;weekRef:number;session:'regular'|'closed';asOf:number};
/** openingUsd: committed opening contribution counted for this week. feeEth: eligible ETH fee receipts so far this week. */
export type PrizeFeed={openingUsd:number;feeEth:number;ethUsd:number|null;rolloverActiveUsd:number;rolloverPassiveUsd:number;asOf:number};
export type SeasonFeed={source:'live'|'demo'|'none';quotes:Record<Ticker,Quote>|null;prize:PrizeFeed|null};

export const useSeasonFeed=create<SeasonFeed>(()=>({source:'none',quotes:null,prize:null}));
export function publishSeasonFeed(feed:Partial<SeasonFeed>){useSeasonFeed.setState(feed);}

// ---- Whitepaper arithmetic ----
export const PRIZE_SHARE_OF_FEES=.7,ACTIVE_SHARE=.8,PASSIVE_SHARE=.2;
/** Round once to the nearest integer, exact halves away from zero. */
export const roundHalfAway=(x:number)=>Math.sign(x)*Math.round(Math.abs(x));
export const weeklyReturnPct=(q:Quote)=>100*(q.last/q.weekRef-1);
export const weeklyPoints=(q:Quote)=>roundHalfAway(weeklyReturnPct(q)*10);
export const dayChangePct=(q:Quote)=>100*(q.last/q.prevClose-1);
export type Direction='up'|'flat'|'down';
/** Outside the regular session the stock modifier is neutral. */
export const direction=(q:Quote):Direction=>q.session!=='regular'||q.last===q.prevClose?'flat':q.last>q.prevClose?'up':'down';
export type Condition='happy'|'neutral'|'stressed';
/** Average stress across living rats: below 30% happy, 30% to below 45% neutral, 45% or more stressed. */
export const colonyCondition=(stress:number):Condition=>stress<.3?'happy':stress<.45?'neutral':'stressed';
const MATRIX:Record<Condition,Record<Direction,number>>={happy:{up:2,flat:1,down:.5},neutral:{up:0,flat:0,down:0},stressed:{up:-.5,flat:-1,down:-2}};
/** Recurring points per 10 minutes for one nest. */
export const recurringPoints=(c:Condition,d:Direction)=>MATRIX[c][d];

export function prizeBreakdown(p:PrizeFeed){
 const feesUsd=p.ethUsd===null?null:p.feeEth*p.ethUsd*PRIZE_SHARE_OF_FEES;
 const fresh=p.openingUsd+(feesUsd??0);
 const active=fresh*ACTIVE_SHARE+p.rolloverActiveUsd,passive=fresh*PASSIVE_SHARE+p.rolloverPassiveUsd;
 return {feesUsd,feePrizeEth:p.feeEth*PRIZE_SHARE_OF_FEES,fresh,active,passive,total:active+passive};
}

// ---- Weekly clock (America/Sao_Paulo; Brazil has used a fixed UTC-3 offset since 2019) ----
const SP=-3*36e5,DAY=864e5,HOUR=36e5;
export type WeekPhase={phase:'settling'|'open'|'final';opensAt:number;switchClosesAt:number;closesAt:number;entryUsd:number|null;nextEntry:{usd:number;at:number}|null};
const ENTRY:[number,number][]=[[72,10],[36,15],[12,20],[0,30]];
export function weekPhase(now=Date.now()):WeekPhase{
 const local=new Date(now+SP),midnight=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())-SP;
 const monday=midnight-((local.getUTCDay()+6)%7)*DAY;
 const opensAt=monday+13*HOUR,switchClosesAt=monday+6*DAY+19*HOUR,closesAt=monday+7*DAY;
 if(now<opensAt)return {phase:'settling',opensAt,switchClosesAt:switchClosesAt-7*DAY,closesAt:monday,entryUsd:null,nextEntry:null};
 const left=(closesAt-now)/HOUR,i=ENTRY.findIndex(([h])=>left>h),tier=i<0?ENTRY.length-1:i;
 const next=tier<ENTRY.length-1?{usd:ENTRY[tier+1][1],at:closesAt-ENTRY[tier][0]*HOUR}:null;
 return {phase:now<switchClosesAt?'open':'final',opensAt,switchClosesAt,closesAt,entryUsd:ENTRY[tier][1],nextEntry:next};
}
export function span(ms:number){const m=Math.max(0,Math.floor(ms/6e4)),d=Math.floor(m/1440),h=Math.floor(m%1440/60),mm=m%60;return d?`${d}d ${h}h`:h?`${h}h ${mm}m`:`${mm}m`;}

/** Regular US session, weekdays 09:30 to 16:00 New York time. Holidays are the live feed's job. */
function usSessionOpen(now:number){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const minutes=Number(parts.hour)*60+Number(parts.minute);
 return !['Sat','Sun'].includes(parts.weekday)&&minutes>=570&&minutes<960;
}

// ---- Demo feed (review builds only; every surface labels it DEMO) ----
let demoTimer=0;
export function startDemoFeed(){
 if(demoTimer||useSeasonFeed.getState().source==='live')return;
 const base:Record<Ticker,[number,number,number]>={NVDA:[100,101.2,98.6],AAPL:[100,99.4,100.8],AMZN:[100,100.3,97.9]};
 const seed=(t:Ticker)=>{const [last,prevClose,weekRef]=base[t];return {last,prevClose,weekRef,session:usSessionOpen(Date.now())?'regular' as const:'closed' as const,asOf:Date.now()};};
 useSeasonFeed.setState({source:'demo',quotes:{NVDA:seed('NVDA'),AAPL:seed('AAPL'),AMZN:seed('AMZN')},prize:{openingUsd:1000,feeEth:.18,ethUsd:2500,rolloverActiveUsd:0,rolloverPassiveUsd:0,asOf:Date.now()}});
 demoTimer=window.setInterval(()=>{const s=useSeasonFeed.getState();if(s.source!=='demo'||!s.quotes||!s.prize)return;
  const session=usSessionOpen(Date.now())?'regular' as const:'closed' as const;
  const quotes=Object.fromEntries(Object.entries(s.quotes).map(([t,q])=>[t,{...q,session,asOf:Date.now(),last:session==='regular'?Math.round(q.last*(1+(Math.random()-.5)*.0016)*100)/100:q.last}])) as Record<Ticker,Quote>;
  useSeasonFeed.setState({quotes,prize:{...s.prize,feeEth:Math.round((s.prize.feeEth+Math.random()*.0012)*1e4)/1e4,asOf:Date.now()}});
 },4000);
}
