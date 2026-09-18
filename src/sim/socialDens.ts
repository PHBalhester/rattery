import type {Rat,World} from '../types.js';
import {socialDens} from './courtyard.js';
import {affinity} from './social.js';
/** Reservations include rats on the way, preventing overbooking at shared entrances. */
export function chooseDen(w:World,r:Rat){
 const living=Object.values(w.rats).filter(q=>q!==r&&q.deadAt===null);
 return socialDens.map((d,index)=>{const peers=living.filter(q=>q.exploration?.den===index&&(q.exploration.denUntil??0)>w.simDay);const slots=new Set(peers.map(q=>q.exploration!.denSlot));const slot=Array.from({length:d.capacity},(_,i)=>i).find(i=>!slots.has(i));const bonds=peers.map(q=>affinity(w,r,q));return {index,slot,score:(bonds.length?bonds.reduce((s,v)=>s+v,0)/bonds.length:0)*.8-peers.length/d.capacity*.45-Math.hypot(r.x-d.x,r.y-d.y)/2000,hostile:bonds.some(v=>v<-.35)};}).filter(d=>d.slot!==undefined&&!d.hostile).sort((a,b)=>b.score-a.score||a.index-b.index)[0];
}
