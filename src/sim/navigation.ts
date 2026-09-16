import {habitatRoutes,lateralRoutes,toyApproaches,obstacles,refugeBlocked,refugePathBlocked} from './habitatLayout';
import {NEST_POS} from './colony';
export type Point={x:number;y:number};
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
function segment(p:Point,a:Point,b:Point){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
const nodes:Point[]=[],edges:number[][]=[];
function add(p:Point){let i=nodes.findIndex(q=>dist(p,q)<.01);if(i<0){i=nodes.length;nodes.push(p);edges.push([]);}return i;}
function link(a:number,b:number){if(a!==b){edges[a].push(b);edges[b].push(a);}}
for(const route of [...habitatRoutes,...lateralRoutes]){let prev=-1;for(const p of route){const i=add({x:p.x,y:p.z});if(prev>=0)link(prev,i);prev=i;}}
for(const a of toyApproaches)link(add({x:a.anchor.x,y:a.anchor.z}),add({x:a.contact.x,y:a.contact.z}));
const segments=edges.flatMap((es,i)=>es.filter(j=>j>i).map(j=>[nodes[i],nodes[j]]));
// Exact spatial index: only segments whose expanded bounds include this cell can be near a point.
const segmentGrid=new Map<string,typeof segments>();
for(const pair of segments){const [a,b]=pair;for(let x=Math.floor((Math.min(a.x,b.x)-12)/64);x<=Math.floor((Math.max(a.x,b.x)+12)/64);x++)for(let y=Math.floor((Math.min(a.y,b.y)-12)/64);y<=Math.floor((Math.max(a.y,b.y)+12)/64);y++){const key=`${x}:${y}`;const bucket=segmentGrid.get(key)??[];bucket.push(pair);segmentGrid.set(key,bucket);}}
/** Conservative walkable corridors, with body clearance from solid toys. */
export function walkable(p:Point){return Number.isFinite(p.x)&&Number.isFinite(p.y)&&!refugeBlocked(p)&&obstacles.every(o=>Math.hypot(p.x-o.p.x,p.y-o.p.z)>=35)&&(dist(p,NEST_POS)<=NEST_POS.r-10||habitatRoutes.some(r=>Math.hypot(p.x-r[81].x,p.y-r[81].z)<=62)||(segmentGrid.get(`${Math.floor(p.x/64)}:${Math.floor(p.y/64)}`)??[]).some(([a,b])=>segment(p,a,b)<=12));}
export function clearPath(a:Point,b:Point){
 if(!walkable(a)||!walkable(b)||refugePathBlocked(a,b)||obstacles.some(o=>segment({x:o.p.x,y:o.p.z},a,b)<35))return false;
 // The nest/chambers are convex: after solid checks, two interior endpoints
 // imply the whole segment is inside. Preserve exact corridor checks elsewhere.
 if(dist(a,NEST_POS)<=NEST_POS.r-10&&dist(b,NEST_POS)<=NEST_POS.r-10)return true;
 for(const route of habitatRoutes){const c=route[81];if(Math.hypot(a.x-c.x,a.y-c.z)<=62&&Math.hypot(b.x-c.x,b.y-c.z)<=62)return true;}
 const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;if(length<1e-16)return true;
 const intervals:[number,number][]=[];
 const circle=(c:Point,r:number)=>{const x=a.x-c.x,y=a.y-c.y,B=x*dx+y*dy,C=x*x+y*y-r*r,D=B*B-length*C;if(D<0)return;const root=Math.sqrt(D);intervals.push([Math.max(0,(-B-root)/length),Math.min(1,(-B+root)/length)]);};
 circle(NEST_POS,NEST_POS.r-10);for(const r of habitatRoutes)circle({x:r[81].x,y:r[81].z},62);
 const candidates=new Set<(typeof segments)[number]>();
 for(let x=Math.floor(Math.min(a.x,b.x)/64);x<=Math.floor(Math.max(a.x,b.x)/64);x++)for(let y=Math.floor(Math.min(a.y,b.y)/64);y<=Math.floor(Math.max(a.y,b.y)/64);y++)for(const pair of segmentGrid.get(`${x}:${y}`)??[])candidates.add(pair);
 for(const [p,q] of candidates){circle(p,12);circle(q,12);const sx=q.x-p.x,sy=q.y-p.y,l=Math.hypot(sx,sy);if(!l)continue;
  let lo=0,hi=1;
  for(const [value,rate,min,max] of [[((a.x-p.x)*sx+(a.y-p.y)*sy)/l,(dx*sx+dy*sy)/l,0,l],[((a.x-p.x)*-sy+(a.y-p.y)*sx)/l,(-dx*sy+dy*sx)/l,-12,12]]){
   if(Math.abs(rate)<1e-12){if(value<min||value>max){lo=2;break;}}
   else{const t0=(min-value)/rate,t1=(max-value)/rate;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));}
  }intervals.push([lo,hi]);
 }
 intervals.sort((a,b)=>a[0]-b[0]);let covered=0;
 for(const [lo,hi] of intervals){if(hi<lo)continue;if(lo>covered+1e-9)return false;covered=Math.max(covered,hi);if(covered>=1-1e-9)return true;}return false;
}
// Navigation samples inside each chamber connect both open ends of the shelter.
// Existing route edges are retained only when their swept path is clear.
for(const route of habitatRoutes){const c=route[81];const local:number[]=[];
 for(let x=-56;x<=62;x+=8)for(let y=-56;y<=62;y+=8){const p={x:c.x+x,y:c.z+y};if(Math.hypot(x,y)<=62&&walkable(p))local.push(add(p));}
 const nearby=nodes.map((p,i)=>({p,i})).filter(({p})=>Math.hypot(p.x-c.x,p.y-c.z)<=70&&walkable(p));
 for(const i of local)for(const {p,j} of nearby.map(v=>({p:v.p,j:v.i})))if(i!==j&&dist(nodes[i],p)<=32&&clearPath(nodes[i],p))link(i,j);
}
for(let i=0;i<edges.length;i++)edges[i]=[...new Set(edges[i])].filter(j=>clearPath(nodes[i],nodes[j]));
/** Map an old guide point inside new scenery to the nearest reachable chamber point. */
export function safeGuide(p:Point):Point{if(walkable(p))return p;const q=nodes.filter(walkable).reduce<Point|undefined>((best,q)=>!best||dist(p,q)<dist(p,best)?q:best,undefined);return q&&dist(q,p)<60?{...q}:p;}
/** Deterministic shortest route; null cancels inaccessible encounters without teleporting. */
export function findPath(a:Point,b:Point):Point[]|null{
 if(!walkable(a)||!walkable(b))return null;
 if(clearPath(a,b))return [{x:b.x,y:b.y}];
 const attach=(p:Point)=>nodes.map((q,i)=>({i,d:dist(p,q)})).sort((a,b)=>a.d-b.d).find(v=>edges[v.i].length>0&&clearPath(p,nodes[v.i]))?.i;
 const start=attach(a),end=attach(b);if(start===undefined||end===undefined)return null;
 const costs=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),done=new Set<number>();costs[start]=0;
 while(done.size<nodes.length){let u=-1;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(u<0||costs[i]<costs[u]))u=i;if(u<0||!Number.isFinite(costs[u]))return null;if(u===end)break;done.add(u);for(const v of edges[u]){const c=costs[u]+dist(nodes[u],nodes[v]);if(c<costs[v]){costs[v]=c;prev[v]=u;}}}
 const path:Point[]=[{x:b.x,y:b.y}];for(let i=end;i!==-1;i=prev[i])path.unshift({...nodes[i]});return path;
}
export function advance(p:Point,path:Point[],budget=1.2){let remaining=budget;const result={x:p.x,y:p.y};while(path.length&&remaining>0){const target=path[0],d=dist(result,target),step=Math.min(remaining,d);if(d>0){result.x+=(target.x-result.x)/d*step;result.y+=(target.y-result.y)/d*step;}remaining-=step;if(d<=step){path.shift();if(d>0)break;}else break;}return result;}

/** Recover legacy/spawn positions just outside a corridor, without teleporting or crossing solids. */
export function recoverPosition(p:Point,budget:number):Point|null{
 if(walkable(p))return null;
 const candidates:Point[]=segments.map(([a,b])=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return {x:a.x+dx*t,y:a.y+dy*t};});
 const d=dist(p,NEST_POS),f=Math.min(1,(NEST_POS.r-11)/(d||1));candidates.push({x:NEST_POS.x+(p.x-NEST_POS.x)*f,y:NEST_POS.y+(p.y-NEST_POS.y)*f});
 const q=candidates.filter(q=>dist(p,q)<=35&&walkable(q)&&!refugePathBlocked(p,q)&&obstacles.every(o=>segment({x:o.p.x,y:o.p.z},p,q)>=35)).sort((a,b)=>dist(p,a)-dist(p,b))[0];
 if(!q)return null;const length=dist(p,q),step=Math.min(1,budget/(length||1));return {x:p.x+(q.x-p.x)*step,y:p.y+(q.y-p.y)*step};
}
