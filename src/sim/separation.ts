import type {Rat,World} from '../types.js';
import {clearPath} from './navigation.js';
import {physique} from './physique.js';
import {inNest} from './colony.js';

const radius=(r:Rat)=>r.stage==='neonate'?3:r.stage==='juvenile'?6:r.stage==='weanling'?9:13;
type Shape={scale:number;hx:number;hy:number};
function shape(r:Rat):Shape{const speed=Math.hypot(r.vx,r.vy);return {scale:radius(r)/13*physique(r.id),hx:speed>.1?r.vx/speed:1,hy:speed>.1?r.vy/speed:0};}
export function separationDistance(a:Rat,b:Rat,shapes?:Map<Rat,Shape>){
 const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),nx=d?dx/d:1,ny=d?dy/d:0;
 const extent=(r:Rat)=>{const s=shapes?.get(r)??shape(r);const dot=nx*s.hx+ny*s.hy;return Math.sqrt(484*dot*dot+100*Math.max(0,1-dot*dot))*s.scale;};
 const paired=a.socialAction?.partner===b.id&&b.socialAction?.partner===a.id;
 if(paired&&a.socialAction?.encounter&&b.socialAction?.encounter)return 0;
 return paired?Math.min(18,radius(a)+radius(b)):extent(a)+extent(b);
}
// Deterministic positional separation, bounded per tick and constrained to
// walkable paths. Never consumes biological RNG or teleports through walls.
export function separateRats(world:World){
 const carried=new Set(Object.values(world.rats).filter(r=>r.deadAt===null&&r.retrieving).map(r=>r.retrieving));
 const spent=new Map<string,number>();
 const rats=Object.values(world.rats).filter(r=>r.deadAt===null&&!carried.has(r.id)).sort((a,b)=>a.id.localeCompare(b.id));
 const shapes=new Map(rats.map(r=>[r,shape(r)]));
 for(let pass=0;pass<4;pass++)for(let i=0;i<rats.length;i++)for(let j=i+1;j<rats.length;j++){
  const a=rats[i],b=rats[j];
  if((spent.get(a.id)??0)>=3&&(spent.get(b.id)??0)>=3)continue;
  if((a.x-b.x)**2+(a.y-b.y)**2>52**2)continue;
  const minimum=separationDistance(a,b,shapes);
  let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  if(d>=minimum)continue;
  if(d<1e-8){let hash=0;for(const c of a.id+'|'+b.id)hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;const angle=(hash%360)*Math.PI/180;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}else{dx/=d;dy/=d;}
  const step=Math.min(1,(minimum-Math.hypot(b.x-a.x,b.y-a.y))*.5);
  const move=(r:Rat,x:number,y:number)=>{
   if(r.socialAction?.encounter)return false;
   // A correction must not erase a moving resident's whole forward step.
   // Keep the full correction budget for stationary residents.
   const motion=Math.hypot(r.vx,r.vy);
   const limit=motion>.1?Math.min(3,motion*.65):3;
   const budget=Math.max(0,limit-(spent.get(r.id)??0));if(!budget)return false;
   let vx=x-r.x,vy=y-r.y;
   // A head-on correction alone cancels locomotion forever. Give moving
   // residents a consistent right-hand passing direction while separating.
   const speed=Math.hypot(r.vx,r.vy);
   if(speed>.1&&vx*r.vx+vy*r.vy<0){
    const lateral=Math.min(1,Math.hypot(vx,vy));
    vx+=-r.vy/speed*lateral;vy+=r.vx/speed*lateral;
   }
   const len=Math.hypot(vx,vy),factor=Math.min(1,budget/(len||1));
   // Slide along a corridor boundary if the direct separating step is blocked.
   for(const turn of [0,.65,-.65,1.2,-1.2]){
    const nx=(vx*Math.cos(turn)-vy*Math.sin(turn))*factor,ny=(vx*Math.sin(turn)+vy*Math.cos(turn))*factor;
    const next={x:r.x+nx,y:r.y+ny};if(clearPath(r,next)){r.x=next.x;r.y=next.y;spent.set(r.id,(spent.get(r.id)??0)+Math.hypot(nx,ny));r.inNest=inNest(r);return true;}
   }return false;
  };
  move(a,a.x-dx*step,a.y-dy*step);move(b,b.x+dx*step,b.y+dy*step);
 }
}
