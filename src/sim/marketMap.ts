import type { Trade, WorldEnv } from "../types.js";
import { clamp01 } from "./hormones.js";

export const BIG_TRADE_USD = 500;
export const GIANT_TRADE_USD = BIG_TRADE_USD * 2;


// BALANCE KNOB (not a mechanic). At 0.04 an untraded nest lost ~0.36 food/day,
// i.e. starved in ~1 day, which is not the "silence slowly starves" the footer
// promises and makes any sparse tape (like the demo, ~tens of trades/day)
// collapse before a 21-23d pregnancy can complete. 0.025 keeps silence lethal
// but on the intended slow timescale. Retune against real Pons volume.
const DECAY_PER_S = 0.025;
// Silence decays food and warmth toward a floor, never to zero, as the public
// map promises. Sells can still push them lower. At this floor adults still
// lose energy (break-even food is ~0.44), so a dead tape still starves the
// nest; it just never reads as an empty world.
const SILENCE_FLOOR = 0.12;

export function emptyEnv(): WorldEnv {
  return {
    food: 0.55,
    warmth: 0.55,
    water: 0.62,
    stress: 0.25,
    dopaminePulse: 0.1,
    lastTradeAt: Date.now(),
    buyPressure: 0.2,
    sellPressure: 0.2,
    holdersApprox: 2,
    forage: 0,
    panic: 0,
  };
}

/**
 * PUBLIC MAP - printed on the site footer, SexFly-style.
 *
 * buy            -> food up, warmth up, VTA dopamine
 * big buy        -> dopamine flood, nest insulation spike
 * new holder     -> dopamine + extra food pulse (new foraging niche)
 * sell           -> food down, warmth down
 * big sell       -> corticosterone spike, nest collapse risk
 * silence        -> pressures decay toward scarcity, never to zero
 */
export function applyTrade(env: WorldEnv, t: Trade): WorldEnv {
  if(!Number.isFinite(t.usd)||t.usd<=0||!Number.isFinite(t.ts)||(t.side!=='buy'&&t.side!=='sell'))return env;
  const next={...env,lastTradeAt:t.ts};
  if(t.side==='buy'&&t.isNewHolder)next.holdersApprox++;
  // Shared real-time token bucket: a burst cannot multiply the biological effect.
  const elapsed=Math.max(0,t.ts-(env.tradeBudgetAt??t.ts));
  const available=Math.min(1,(env.tradeBudget??1)+elapsed/60000);
  const small=t.usd<50;
  const intensity=small?Math.min(.01,t.usd/5000):t.usd<250?.08:t.usd<500?.16:t.usd<1000?.25:.35;
  const effect=Math.min(available,intensity);
  next.tradeBudget=available-effect;next.tradeBudgetAt=Math.max(t.ts,env.tradeBudgetAt??t.ts);
  if(t.side==='buy'){
    next.food=clamp01(next.food+effect*.1);next.water=clamp01(next.water+effect*.08);
    next.warmth=clamp01(next.warmth+effect*.06);next.stress=clamp01(next.stress-effect*.05);
  }else next.stress=clamp01(next.stress+effect*.1);
  // Common small trades never set movement/animation/social drives.
  if(small)return next;
  if(t.ts<(env.nextTradeReactionAt??0))return next;
  next.nextTradeReactionAt=t.ts+10000;
  const drive=t.usd<250?.08:t.usd<500?.18:t.usd<1000?.3:.4;
  if(t.side==='buy'){
    next.buyPressure=clamp01(next.buyPressure*.82+drive);
    next.forage=clamp01(next.forage+drive);next.panic=clamp01(next.panic-drive);
    next.dopaminePulse=clamp01(next.dopaminePulse+drive);
  }else{
    next.sellPressure=clamp01(next.sellPressure*.82+drive);
    next.panic=clamp01(next.panic+drive);next.forage=clamp01(next.forage-drive);
  }
  if(t.usd>=GIANT_TRADE_USD)next.socialSignals=[t.side];
  else if(t.usd>=BIG_TRADE_USD)next.groupSignal=t.side;

  return next;
}

export function decayEnv(env: WorldEnv, dtSec: number): WorldEnv {
  const d = DECAY_PER_S * dtSec;
  return {
    ...env,
    food: env.food > SILENCE_FLOOR ? Math.max(SILENCE_FLOOR, env.food - d * 0.15) : env.food,
    warmth: env.warmth > SILENCE_FLOOR ? Math.max(SILENCE_FLOOR, env.warmth - d * 0.12) : env.warmth,
    water: (env.water ?? 0.55) > SILENCE_FLOOR ? Math.max(SILENCE_FLOOR, (env.water ?? 0.55) - d * 0.13) : (env.water ?? 0.55),
    stress: clamp01(env.stress * (1 - d * 0.4) + 0.12 * d * 2),
    dopaminePulse: clamp01(env.dopaminePulse - d * 1.2),
    buyPressure: clamp01(env.buyPressure - d * 0.5),
    sellPressure: clamp01(env.sellPressure - d * 0.5),
    forage: clamp01(env.forage - d * 1.6),
    panic: clamp01(env.panic - d * 1.3),
  };
}
