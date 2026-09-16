import assert from 'node:assert/strict';
import {createWorld} from '../src/sim/colony';
import {ecologyStep,zones,remember,individualStress} from '../src/sim/ecology';
import {pairKey} from '../src/sim/social';
function population(spread:boolean){const w=createWorld(9),template=Object.values(w.rats)[0];w.rats={};for(let i=0;i<60;i++){const z=zones[spread?i%6:0];w.rats[`r${i}`]={...JSON.parse(JSON.stringify(template)),id:`r${i}`,x:z.x,y:z.y,energy:1};}w.env.stress=.1;w.env.water=1;return w;}
const packed=population(false),spread=population(true);
for(let i=0;i<100;i++){for(const w of [packed,spread]){w.simDay+=.01;ecologyStep(w,.01);}}
const avg=(w:ReturnType<typeof createWorld>)=>Object.values(w.rats).reduce((s,r)=>s+individualStress(r,0),0)/60;
assert(avg(packed)>avg(spread));
const clone=JSON.parse(JSON.stringify(spread));ecologyStep(spread,.01);ecologyStep(clone,.01);assert.deepEqual(spread,clone);
const [a,b]=Object.values(spread.rats);remember(spread,a,b,'care');remember(spread,a,b,'shared',.08);assert.equal(spread.ecology!.memories[pairKey(a,b)].care,1);
b.deadAt=spread.simDay;ecologyStep(spread,.01);assert(!spread.ecology!.memories[pairKey(a,b)]);
for(const r of Object.values(packed.rats))for(const value of [r.wellbeing!.acute,r.wellbeing!.chronic,r.wellbeing!.hydration])assert(Number.isFinite(value)&&value>=0&&value<=1);
console.log('PASS: same population/different layout, finite stress, JSON replay, social memory, death cleanup');
