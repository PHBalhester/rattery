import { getAddress } from 'ethers';
export const OPEN = 1790611200, CLOSE = 1791169200;
export type Nest = 1 | 2 | 3;
export const addr = (s: string) => getAddress(s).toLowerCase();
export function unsigned(n: bigint) { if (n < 0n)
    throw Error('Negative amount'); return n; }
export function roundAway(n: bigint, d: bigint) { if (d <= 0n)
    throw Error('Invalid denominator'); const sign = n < 0n ? -1n : 1n, a = n < 0n ? -n : n; return sign * ((a + d / 2n) / d); }
export function weeklyAdjustment(start: bigint, end: bigint) { if (start <= 0n || end <= 0n)
    throw Error('Missing stock reference'); return roundAway((end - start) * 1000n, start); }
export interface Standing {
    nest: Nest;
    halves: bigint;
    gross: bigint;
    lastProductionOrder: bigint;
    startPrice: bigint;
    endPrice: bigint;
}
export function winner(rows: Standing[]) { if (rows.length !== 3 || new Set(rows.map(r => r.nest)).size !== 3 || rows.some(r => ![1, 2, 3].includes(r.nest)))
    throw Error('Three unique nests required'); return rows.map(r => { unsigned(r.halves); unsigned(r.gross); unsigned(r.lastProductionOrder); const adjustment = weeklyAdjustment(r.startPrice, r.endPrice), score = r.halves + 2n * adjustment; return { ...r, adjustment, finalHalves: score < 0n ? 0n : score }; }).sort((a, b) => a.finalHalves !== b.finalHalves ? (a.finalHalves > b.finalHalves ? -1 : 1) : a.gross !== b.gross ? (a.gross > b.gross ? -1 : 1) : a.gross > 0n && a.lastProductionOrder !== b.lastProductionOrder ? (a.lastProductionOrder < b.lastProductionOrder ? -1 : 1) : a.nest - b.nest); }
export interface Transfer {
    block: number;
    logIndex: number;
    at: number;
    from: string;
    to: string;
    units: bigint;
}
/** Opening balances must be anchored immediately before OPEN; no endpoint averages. */
export function timeWeighted(opening: Map<string, bigint>, transfers: Transfer[], open = OPEN, close = CLOSE) {
    if (!Number.isSafeInteger(open) || !Number.isSafeInteger(close) || close <= open)
        throw Error('Invalid window');
    const balances = new Map<string, bigint>(), areas = new Map<string, bigint>(), last = new Map<string, number>();
    for (const [w, n] of opening) {
        const a = addr(w);
        if (balances.has(a))
            throw Error('Duplicate balance');
        if (a === '0x' + '0'.repeat(40) && n !== 0n)
            throw Error('Zero-address opening balance');
        balances.set(a, unsigned(n));
    }
    const zero = '0x' + '0'.repeat(40);
    let prevBlock = -1, prevLog = -1, prevTime = open;
    const accrue = (w: string, t: number) => { if (w === zero)
        return; areas.set(w, (areas.get(w) ?? 0n) + (balances.get(w) ?? 0n) * BigInt(t - (last.get(w) ?? open))); last.set(w, t); };
    for (const t of transfers) {
        if (!Number.isSafeInteger(t.block) || !Number.isSafeInteger(t.logIndex) || t.block < 0 || t.logIndex < 0 || !Number.isSafeInteger(t.at) || t.at < prevTime || t.at < open || t.at >= close || t.block < prevBlock || t.block === prevBlock && t.logIndex <= prevLog)
            throw Error('Unordered or out-of-window transfer');
        prevBlock = t.block;
        prevLog = t.logIndex;
        prevTime = t.at;
        unsigned(t.units);
        const from = addr(t.from), to = addr(t.to);
        accrue(from, t.at);
        if (from !== to)
            accrue(to, t.at);
        if (from !== zero) {
            const b = (balances.get(from) ?? 0n) - t.units;
            if (b < 0n)
                throw Error('Incomplete balance history');
            balances.set(from, b);
        }
        if (to !== zero)
            balances.set(to, (balances.get(to) ?? 0n) + t.units);
    }
    for (const w of balances.keys())
        accrue(w, close);
    return { areas, balances, duration: BigInt(close - open) };
}
export function allocate(total: bigint, weights: Map<string, bigint>) { unsigned(total); const rows = [...weights].map(([w, n]) => ({ wallet: addr(w), weight: unsigned(n) })).filter(r => r.weight > 0n); if (new Set(rows.map(r => r.wallet)).size !== rows.length)
    throw Error('Duplicate recipient'); const sum = rows.reduce((s, r) => s + r.weight, 0n); if (sum === 0n)
    return { amounts: new Map<string, bigint>(), rollover: total }; const amounts = new Map(rows.map(r => [r.wallet, total * r.weight / sum] as const).filter(([, n]) => n > 0n)); return { amounts, rollover: total - [...amounts.values()].reduce((s, n) => s + n, 0n) }; }
export interface Member {
    wallet: string;
    nest: Nest;
    membership: bigint;
    contribution: bigint;
    holdingBonusBps: number;
    burnerBonusBps: number;
}
export function rewards(input: {
    stockUnits: bigint;
    prizeFunding?: { playersUSD: number; holdersUSD: number };
    activeCarry: bigint;
    passiveCarry: bigint;
    winner: Nest;
    members: Member[];
    areas: Map<string, bigint>;
    duration: bigint;
    threshold: bigint;
    excluded: Set<string>;
}) {
    const { stockUnits, duration, threshold } = input;
    unsigned(stockUnits);
    unsigned(input.activeCarry);
    unsigned(input.passiveCarry);
    if (duration <= 0n || threshold <= 0n)
        throw Error('Holding threshold/window required');
    if (![1, 2, 3].includes(input.winner))
        throw Error('Invalid winner');
    const excluded = new Set(['0x' + '0'.repeat(40), ...input.excluded].map(addr)), active = new Map<string, bigint>(), seen = new Set<string>();
    for (const m of input.members) {
        const wallet = addr(m.wallet);
        if (seen.has(wallet))
            throw Error('Multiple active memberships');
        seen.add(wallet);
        if (m.membership <= 0n || m.contribution < 0n || ![1, 2, 3].includes(m.nest) || ![0, 200, 300, 500].includes(m.holdingBonusBps) || !Number.isInteger(m.burnerBonusBps) || ![0, 500].includes(m.burnerBonusBps) || m.holdingBonusBps + m.burnerBonusBps > 2000)
            throw Error('Invalid membership bonus');
        if (m.nest === input.winner && !excluded.has(wallet))
            active.set(wallet, m.contribution * BigInt(10000 + m.holdingBonusBps + m.burnerBonusBps));
    }
    const passive = new Map<string, bigint>(), holderSeen = new Set<string>();
    for (const [wallet, area] of input.areas) {
        unsigned(area);
        const w = addr(wallet);
        if (holderSeen.has(w))
            throw Error('Duplicate holder');
        holderSeen.add(w);
        if (!excluded.has(w) && area >= threshold * duration)
            passive.set(w, area);
    }
    const funding = input.prizeFunding ?? { playersUSD: 80, holdersUSD: 20 };
    if (![funding.playersUSD, funding.holdersUSD].every(n => Number.isSafeInteger(n) && n > 0))
        throw Error('Positive integer prize funding required');
    const players = BigInt(funding.playersUSD), holders = BigInt(funding.holdersUSD);
    const activeBase = stockUnits * players / (players + holders);
    const activePool = activeBase + input.activeCarry, passivePool = stockUnits - activeBase + input.passiveCarry, a = allocate(activePool, active), p = allocate(passivePool, passive), wallets = new Set([...a.amounts.keys(), ...p.amounts.keys()]);
    return { activePool, passivePool, activeRollover: a.rollover, passiveRollover: p.rollover, rows: [...wallets].sort().map(wallet => ({ wallet, active: a.amounts.get(wallet) ?? 0n, passive: p.amounts.get(wallet) ?? 0n, total: (a.amounts.get(wallet) ?? 0n) + (p.amounts.get(wallet) ?? 0n) })) };
}
