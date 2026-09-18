import assert from 'node:assert/strict';
import {applyTrade,decayEnv,emptyEnv} from '../src/sim/marketMap.js';
import {createWorld} from '../src/sim/colony.js';import {tick} from '../src/sim/tick.js';import {worldRng} from '../src/sim/rng.js';import {CONFIG} from '../src/config.js';import type {Trade} from '../src/types.js';
const S=CONFIG.survival;
const trade=(usd:number,ts:number,side:'buy'|'sell'='buy'):Trade=>({id:side+ts,ts,side,usd,eth:usd/2400,tokens:0,trader:'test',venue:'demo'});
// One loop step = 1 real minute; decayEnv(_,60) = 1 sim-day. 1440 steps = 24
// real hours. Trade timestamps advance on the same real clock as the budget.

// 1. Buy-only support at three cadences.
for(const [usd,interval] of [[25,3],[100,10],[500,30]]){
 let e=emptyEnv();for(let minute=0;minute<1440;minute++){if(minute%interval===0)e=applyTrade(e,trade(usd,minute*60000));e=decayEnv(e,60);}
 assert(e.food>=.65&&e.water>=.65&&e.warmth>=.55);assert(e.warmth<=S.buyWarmthCap);
 console.log('PASS buy support',usd,interval,e.food.toFixed(3),e.water.toFixed(3),e.warmth.toFixed(3));
}

// 2. Balanced tape: equal buy and sell dollar volume must trend to survival,
// not extinction. This is the property the buy/sell asymmetry exists for.
{
 let e=emptyEnv();
 for(let minute=0;minute<1440;minute++){if(minute%5===0)e=applyTrade(e,trade(100,minute*60000,minute%10===0?'buy':'sell'));e=decayEnv(e,60);}
 assert(e.food>=.5&&e.water>=.5);
 console.log('PASS balanced tape',e.food.toFixed(3),e.water.toFixed(3));
}

// 3. Sells must actually bite: a sell-heavy tape drives resources below the
// silence floor, and still never to zero.
{
 let e=emptyEnv();
 for(let minute=0;minute<240;minute++){if(minute%2===0)e=applyTrade(e,trade(500,minute*60000,'sell'));e=decayEnv(e,60);}
 assert(e.food<.12&&e.water<.12&&e.warmth<.12);
 assert(e.food>=S.sellFloor&&e.water>=S.sellFloor&&e.warmth>=S.sellFloor);
 console.log('PASS sell bite',e.food.toFixed(3),e.water.toFixed(3),e.warmth.toFixed(3));
}

// 4. Dollar for dollar, a buy must help more than a sell hurts.
{
 const base=emptyEnv(),up=applyTrade(base,trade(100,0,'buy')),down=applyTrade(base,trade(100,0,'sell'));
 const gain=up.food-base.food,loss=base.food-down.food;
 assert(gain>loss*2&&loss>0);
 console.log('PASS buy/sell asymmetry gain',gain.toFixed(4),'loss',loss.toFixed(4));
}

// 5. Seeded biology with regular buys. Coarse dt keeps this test inside the CI
// budget; the live 100ms step is covered by survival-production-resolution-test.
for(const seed of [7,41,20260911]){
 const w=createWorld(seed),rng=worldRng(w);
 for(let i=0;i<12000;i++){if(i%1000===0)w.env=applyTrade(w.env,trade(100,i*600));tick(w,.01,rng);}
 const alive=Object.values(w.rats).filter(r=>r.deadAt===null);
 assert(alive.length>0);assert(!w.extinct);
 console.log('PASS supported 120-day biology',seed,alive.length,w.totals.deaths);
}
