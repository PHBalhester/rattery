import {movementSpeed} from '../src/sim/movementSpeed';
import assert from 'node:assert/strict';
import {NEST_POS,createWorld} from '../src/sim/colony';
import {socialStep,pairKey,affinity} from '../src/sim/social';
import {applyTrade,GIANT_TRADE_USD} from '../src/sim/marketMap';
import type {Trade} from '../src/types';
const t=(side:'buy'|'sell',usd:number)=>({id:'x',ts:1,side,usd,eth:usd/2400,tokens:1,trader:'a',isNewHolder:false,venue:'demo'} as Trade);
const setup=()=>{const w=createWorld(9);w.social={affinities:{},cooldown:0,nextAmbient:99};const rs=Object.values(w.rats);for(const r of rs){r.x=NEST_POS.x;r.y=NEST_POS.y;r.energy=1;r.pregnant=null;r.nursing=[];}for(const a of rs)for(const b of rs)if(a!==b)w.social.affinities[pairKey(a,b)]=0;return {w,rs};};
assert.equal(GIANT_TRADE_USD,1000);assert.equal(applyTrade(createWorld().env,t('buy',999)).socialSignals,undefined);
{const {w,rs}=setup(),f=rs.find(r=>r.sex==='F')!,ms=rs.filter(r=>r.sex==='M');w.social!.affinities[pairKey(f,ms[0])]=.5;w.social!.affinities[pairKey(f,ms[1])]=.9;w.env=applyTrade(w.env,t('buy',1000));socialStep(w,.001,()=>0);assert.equal(f.socialAction?.partner,ms[1].id);assert.equal(f.socialAction?.kind,'mating');assert(f.pregnant);socialStep(w,.001,()=>0);assert.equal(f.socialAction?.kind,'mating');const clone=JSON.parse(JSON.stringify(w));w.simDay+=.01;clone.simDay+=.01;socialStep(w,.01,()=>0);socialStep(clone,.01,()=>0);assert.deepEqual(w,clone);}
{const {w,rs}=setup(),[a,b]=rs;w.social!.affinities[pairKey(a,b)]=-.9;w.env=applyTrade(w.env,t('sell',1000));socialStep(w,.01,()=>.5);assert.equal(a.socialAction?.kind,'fight');assert((a.injury??0)>0);for(let i=0;i<100;i++){w.simDay+=.01;socialStep(w,.01,()=>.5);}assert((a.injury??0)<.1);assert(!a.socialAction);assert(affinity(w,a,b)>=-1);}
{const {w,rs}=setup();rs.forEach(r=>r.stage='juvenile');w.env=applyTrade(w.env,t('buy',1000));socialStep(w,.01,()=>0);assert(rs.every(r=>!r.socialAction&&!r.pregnant));}
console.log('PASS: threshold, highest affinity, single conception, mating lifetime, snapshot, conflict damage, expiry, juvenile exclusion');

// Distant partners follow a saved route; panic and missing partners cancel safely.
{const {habitatRoutes}=await import('../src/sim/habitatLayout');const {clearPath}=await import('../src/sim/navigation');const {w,rs}=setup(),f=rs.find(r=>r.sex==='F')!,m=rs.find(r=>r.sex==='M')!;const p=habitatRoutes[0][60],q=habitatRoutes[1][60];f.x=p.x;f.y=p.z;m.x=q.x;m.y=q.z;w.social!.affinities[pairKey(f,m)]=.9;w.env.socialSignals=['buy'];socialStep(w,.0001,()=>1);assert(f.socialAction);for(let i=0;i<2000&&f.socialAction?.kind!=='mating';i++){const before=rs.map(r=>({x:r.x,y:r.y}));w.simDay+=.0001;socialStep(w,.0001,()=>1);for(const r of [f,m]){const old=before[rs.indexOf(r)];assert(clearPath(old,r));assert(Math.hypot(r.x-old.x,r.y-old.y)<=movementSpeed(r,w)+.000001);}}assert.equal(f.socialAction?.kind,'mating');}
{const {w,rs}=setup(),[a,b]=rs;a.socialAction={kind:'courtship',partner:b.id,until:3};b.socialAction={kind:'courtship',partner:a.id,until:3};w.env.panic=1;socialStep(w,.001,()=>0);assert(!a.socialAction&&!b.socialAction);}
{const {w,rs}=setup(),[a,b]=rs;a.socialAction={kind:'groom',partner:b.id,until:3};b.deadAt=w.simDay;socialStep(w,.001,()=>0);assert(!a.socialAction);}
console.log('PASS: distant encounter follows corridors, panic and death cancel');
