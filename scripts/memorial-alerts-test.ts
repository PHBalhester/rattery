import assert from 'node:assert/strict';
import {createWorld,kill} from '../src/sim/colony';
import {colonyAlerts} from '../src/render/colonyAlerts';
import {colonyMetrics} from '../src/sim/colonyMetrics';
const w=createWorld(1),r=structuredClone(Object.values(w.rats)[0]);r.id='test-child';r.gen=1;r.name='Memorial Test';r.offspring=0;r.bornAt=-12;w.rats[r.id]=r;w.simDay=2;const rng=w.rngState;
kill(w,r,'starvation');assert(!w.rats[r.id]);assert.equal(w.memorial?.[r.id].name,'Memorial Test');assert.equal(w.memorial?.[r.id].deadAt,2);assert.equal(w.memorial?.[r.id].deathCause,'starvation');assert.equal(w.rngState,rng);
kill(w,r,'cold');assert.equal(w.totals.deaths,1);assert.equal(Object.keys(w.memorial!).length,1);assert.deepEqual(JSON.parse(JSON.stringify(w)).memorial,w.memorial);
const m=colonyMetrics(w);m.hunger=.449;assert(!colonyAlerts(w,m).some(a=>a.key==='hunger'));m.hunger=.45;assert.equal(colonyAlerts(w,m).find(a=>a.key==='hunger')?.critical,false);m.hunger=.75;assert.equal(colonyAlerts(w,m).find(a=>a.key==='hunger')?.critical,true);
for(const rat of Object.values(w.rats)){rat.energy=.1;rat.injury=.6;rat.wellbeing={acute:.9,chronic:.9,hydration:.1,lastWater:0,cause:'test',support:0,crowding:.9,zone:0};}
const alerts=colonyAlerts(w);for(const key of ['dehydrated','exhausted','injured','criticalStress'])assert(alerts.some(a=>a.key===key&&a.critical),key);
for(const rat of Object.values(w.rats))kill(w,rat,'age');assert(colonyAlerts(w).some(a=>a.key==='extinct'));assert.equal(Object.keys(w.memorial!).length,5);console.log('PASS memorial pruning, duplicate deaths, JSON persistence, RNG isolation, warning boundaries, critical and extinction alerts');

import {sealSnapshot,validateSnapshot} from '../src/sim/snapshot';
import {CONFIG} from '../src/config';
const saved=createWorld(CONFIG.colony.seed);kill(saved,Object.values(saved.rats)[0],'age');
const identity={chainId:4663,token:'0x'+'1'.repeat(40),birthBlock:1};
const snapshot=await sealSnapshot({identity,t0:1000,cursor:{tick:0,lastKey:-1},anchor:{block:1,hash:'0x'+'2'.repeat(64),timestamp:1000},holders:[],world:saved});
assert.deepEqual((await validateSnapshot(snapshot,identity)).world.memorial,saved.memorial);
const broken=structuredClone(snapshot);(Object.values(broken.world.memorial!)[0] as any).deadAt='invalid';await assert.rejects(()=>validateSnapshot(broken,identity),/Invalid memorial/);
console.log('PASS sealed snapshot memorial restoration and malformed record rejection');
