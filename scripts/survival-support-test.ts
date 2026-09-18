import assert from 'node:assert/strict';
import {applyTrade,decayEnv,emptyEnv} from '../src/sim/marketMap.js';
import {createWorld} from '../src/sim/colony.js';import {tick} from '../src/sim/tick.js';import {worldRng} from '../src/sim/rng.js';import type {Trade} from '../src/types.js';
const trade=(usd:number,ts:number):Trade=>({id:String(ts),ts,side:'buy',usd,eth:usd/2400,tokens:0,trader:'test',venue:'demo'});
for(const [usd,interval] of [[25,3],[100,10],[500,30]]){
 let e=emptyEnv();for(let minute=0;minute<1440;minute++){if(minute%interval===0)e=applyTrade(e,trade(usd,minute*60000));e=decayEnv(e,60);}
 assert(e.food>=.65&&e.water>=.65&&e.warmth>=.55);assert(e.warmth<=.72);console.log('PASS resource support',usd,interval,e.food,e.water);
}
// Multiple seeded biological runs with regular buys. Large dt is confined to
// this survival stress test; production retains its fixed 100ms stepping.
for(const seed of [7,41,20260911]){const w=createWorld(seed),rng=worldRng(w);for(let i=0;i<12000;i++){if(i%1000===0)w.env=applyTrade(w.env,trade(100,i*600));tick(w,.01,rng);}const alive=Object.values(w.rats).filter(r=>r.deadAt===null);assert(alive.length>0);assert(!w.extinct);console.log('PASS supported 120-day biology',seed,alive.length,w.totals.deaths);}
