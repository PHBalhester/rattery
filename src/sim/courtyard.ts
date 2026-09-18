// Shared scene/navigation geometry; coordinates preserve existing habitat routes.
export const courtyardAreas=[{x:800,y:800,r:190},{x:620,y:810,r:125},{x:980,y:810,r:125},...[550,580,610,640].map(y=>({x:800,y,r:40}))];
export const inCourtyard=(p:{x:number;y:number})=>courtyardAreas.some(c=>Math.hypot(p.x-c.x,p.y-c.y)<=c.r);
export const socialDens=[{x:620,y:830,capacity:6},{x:800,y:850,capacity:6},{x:980,y:830,capacity:6}];
export const denWalls=socialDens.flatMap(d=>[-1,1].map(sign=>({x:d.x+sign*70,y:d.y,halfX:4,halfY:65})));
export const courtyardLoop=[{x:800,y:520},{x:800,y:620},{x:800,y:690},{x:680,y:730},{x:520,y:810},{x:520,y:850},{x:610,y:930},{x:730,y:955},{x:870,y:955},{x:990,y:930},{x:1080,y:850},{x:1080,y:810},{x:920,y:730},{x:800,y:690},{x:800,y:620},{x:800,y:520}];
export function denSeat(index:number,slot:number){const d=socialDens[index];return {x:d.x+(slot%2?24:-24),y:d.y+(Math.floor(slot/2)-1)*46};}
