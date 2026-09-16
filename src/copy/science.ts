// Footer honesty. This is not a whole-rat connectome and the copy says so.
export const SCIENCE_COPY = `The burrow is not a whole-rat connectome. A rat brain is ~200 million neurons.
What runs here is a colony of agents with published reproductive physiology
and a small hypothalamic graph for the mother on screen.

Time is compressed: 1 simulated day = 60 real seconds.
Gestation 21 to 23 d. Postpartum estrus 6 to 15 h after birth, fertile about half the time.
A dam can nurse one litter while carrying the next. Eyes open day 14. Wean day 21.

Nodes on the graph: VNO, AOB, MeA, BNST, VMHvl, MPOA, PVN, ARH, VTA, NAc, PAG, HPA.
This is circuit-level cartooning, not electron-microscope wiring.

The token never enters a wallet in this sim. Buys raise food and warmth and pulse dopamine.
Sells raise corticosterone. Silence slowly starves the nest.
The tape is read straight from Robinhood Chain: buys and sells on the Pons
bonding curve, then Uniswap v4 swaps once it graduates. No aggregator in between.
Litters conceived in a crash inherit higher stress gain. That is selection, not a storyboard.

Refs: Connor & Davis 1980 postpartum estrus; Numan MPOA maternal circuit;
Swanson whole-rat regional connectome 2024 (not used as synapse graph);
MICrONS 1 mm3 mouse cortex (not used). No Shiu-style whole-brain LIF for rat exists.`;

// The market -> biology contract, printed next to the science note.
export const PUBLIC_MAP: { signal: string; effect: string }[] = [
  { signal: "buy", effect: "food up, warmth up, VTA dopamine" },
  { signal: "big buy", effect: "dopamine flood, nest insulation spike" },
  { signal: "new holder", effect: "dopamine + extra food pulse (new foraging niche)" },
  { signal: "sell", effect: "food down, warmth down" },
  { signal: "big sell", effect: "corticosterone spike, nest collapse risk" },
  { signal: "silence", effect: "pressures decay toward scarcity, never to zero" },
];

export const HERO = {
  title: "RATTERY",
  tagline: "A nest that treats the tape as weather.",
  body: `Two founding pairs. Then litters. Then litters on top of litters.
If people buy, the nest stays warm and the pups keep their eyes.
If people sell, corticosterone climbs and the next generation comes out smaller, fewer, sharper.

They do not trade.
They only live here.`,
};
