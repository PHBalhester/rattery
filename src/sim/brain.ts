// A small hypothalamic + limbic graph for the on-screen mother. This is
// circuit-level cartooning, not a synapse-level wiring diagram.
export const BRAIN_NODES = [
  { id: "VNO", label: "vomeronasal", x: 0.12, y: 0.28, color: "#7c9a6e" },
  { id: "AOB", label: "acc. olfactory", x: 0.22, y: 0.18, color: "#7c9a6e" },
  { id: "MeA", label: "med. amygdala", x: 0.34, y: 0.38, color: "#c9844a" },
  { id: "BNST", label: "BNST", x: 0.42, y: 0.22, color: "#c9844a" },
  { id: "VMHvl", label: "VMHvl", x: 0.52, y: 0.48, color: "#d4574a" },
  { id: "MPOA", label: "MPOA", x: 0.58, y: 0.28, color: "#e8c36a" },
  { id: "PVN", label: "PVN (OT)", x: 0.68, y: 0.18, color: "#f2ead8" },
  { id: "ARH", label: "arcuate", x: 0.7, y: 0.52, color: "#8b6b4a" },
  { id: "VTA", label: "VTA", x: 0.8, y: 0.4, color: "#6aa7d4" },
  { id: "NAc", label: "NAc", x: 0.88, y: 0.28, color: "#6aa7d4" },
  { id: "PAG", label: "PAG", x: 0.86, y: 0.62, color: "#9a6bb5" },
  { id: "HPA", label: "PVN-CRH", x: 0.62, y: 0.68, color: "#8a3030" },
] as const;

export const BRAIN_EDGES: [string, string][] = [
  ["VNO", "AOB"],
  ["AOB", "MeA"],
  ["MeA", "BNST"],
  ["MeA", "VMHvl"],
  ["BNST", "MPOA"],
  ["VMHvl", "PAG"],
  ["MPOA", "PVN"],
  ["MPOA", "VTA"],
  ["ARH", "MPOA"],
  ["ARH", "HPA"],
  ["PVN", "PAG"],
  ["VTA", "NAc"],
  ["HPA", "MPOA"],
  ["HPA", "VTA"],
];

export function brainActivation(args: {
  cort: number;
  ot: number;
  prl: number;
  da: number;
  e2: number;
  givingBirth: boolean;
  retrieving: boolean;
  food: number;
}) {
  const { cort, ot, prl, da, e2, givingBirth, retrieving, food } = args;
  return {
    VNO: 0.2 + e2 * 0.2,
    AOB: 0.2 + e2 * 0.15,
    MeA: 0.15 + cort * 0.4,
    BNST: 0.2 + e2 * 0.3,
    VMHvl: givingBirth ? 0.2 : 0.15 + (1 - prl) * 0.3,
    MPOA: 0.2 + prl * 0.45 + ot * 0.3 + (retrieving ? 0.3 : 0),
    PVN: givingBirth ? 1 : 0.1 + ot * 0.8,
    ARH: 0.15 + (1 - food) * 0.7,
    VTA: 0.1 + da * 0.8,
    NAc: 0.1 + da * 0.7,
    PAG: givingBirth ? 0.85 : 0.15 + ot * 0.3,
    HPA: 0.1 + cort * 0.9,
  } as Record<string, number>;
}
