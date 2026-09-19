import type {World,Rat} from '../types.js';
import {kill} from './colony.js';
export const SNAKE_DEN={x:1378,y:740,radius:90};
export function snakeEligible(w:World,r:Rat){
 const living=Object.values(w.rats).filter(a=>a.deadAt===null);
 return !w.careProtection?.active&&living.length>60&&r.deadAt===null&&r.stage==='adult'&&!r.minted&&!w.care?.owners[r.id]&&!r.pregnant&&!r.nursing.length&&!r.retrieving&&!r.socialAction&&living.filter(a=>a.stage==='adult'&&a.sex===r.sex).length>2&&!living.some(a=>a.nursing.includes(r.id));
}
export function snakeStep(w:World,dt:number,rng:()=>number){
 const s=w.snake??={nextAttack:w.simDay+10};
 if(w.careProtection?.active){s.capture=undefined;return;}
 if(s.capture){
  const r=w.rats[s.capture.ratId];
  if(!r||!snakeEligible(w,r)){s.capture=undefined;return;}
  r.x=s.capture.x;r.y=s.capture.y;r.vx=0;r.vy=0;
  if(w.simDay>=s.capture.started+.1){kill(w,r,'predation');s.capture=undefined;s.nextAttack=w.simDay+20;s.awakeUntil=undefined;}
  return;
 }
 if(w.simDay<s.nextAttack)return;
 const candidates=Object.values(w.rats).filter(r=>snakeEligible(w,r)&&Math.hypot(r.x-SNAKE_DEN.x,r.y-SNAKE_DEN.y)<SNAKE_DEN.radius);
 if(!candidates.length||rng()>=1-Math.exp(-dt*(s.awakeUntil&&s.awakeUntil>w.simDay?3:.015)))return;
 const r=candidates[Math.min(candidates.length-1,Math.floor(rng()*candidates.length))];
 s.capture={ratId:r.id,started:w.simDay,x:r.x,y:r.y};
}
