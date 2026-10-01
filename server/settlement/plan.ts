import { ContractFactory, Interface, getCreateAddress, parseUnits } from 'ethers';
import { OPEN, CLOSE, addr, rewards, winner } from './math.js';
import { CHAIN, TREASURY, ROUTER, TOKEN, SEASON, STOCKS, EXCLUDED, PAYOUT_ABI } from './config.js';
import { digest, tree } from './manifest.js';
import type { Snapshot } from './collect.js';
export interface References {
    version: 1;
    season: string;
    // Values must come from the published five-minute reference, not the current spot price.
    passiveThreshold: string;
    holdingThreshold: string;
    thresholdEvidence: string;
    stocks: {
        nest: 1 | 2 | 3;
        startPrice: string;
        endPrice: string;
        startSession: string;
        endSession: string;
        evidence: string;
        splitAdjusted: true;
    }[];
    additionalExclusions: string[];
}
export function validateReferences(r: References) {
    if (r.version !== 1 || r.season !== SEASON || !r.thresholdEvidence?.trim() || BigInt(r.passiveThreshold) <= 0n || BigInt(r.holdingThreshold) <= BigInt(r.passiveThreshold) || !Array.isArray(r.additionalExclusions) || r.stocks.length !== 3 || new Set(r.stocks.map(s => s.nest)).size !== 3)
        throw Error('Reviewed references required');
    for (const s of r.stocks) {
        if (![1, 2, 3].includes(s.nest) || BigInt(s.startPrice) <= 0n || BigInt(s.endPrice) <= 0n || s.startSession !== '2026-09-25' || s.endSession !== '2026-10-02' || s.splitAdjusted !== true || !s.evidence?.trim())
            throw Error('Season I regular-session references required');
    }
    r.additionalExclusions.forEach(addr);
    return digest(r);
}
export function hydrateSnapshot(raw: any): Snapshot {
    return { ...raw, duration: BigInt(raw.duration), members: raw.members.map((m: any) => ({ ...m, membership: BigInt(m.membership), contribution: BigInt(m.contribution) })), areas: raw.areas.map(([w, a]: [
            string,
            string
        ]) => [w, BigInt(a)]), nests: raw.nests.map((n: any) => ({ ...n, halves: BigInt(n.halves), gross: BigInt(n.gross), lastProductionOrder: BigInt(n.lastProductionOrder) })) };
}
export async function prepare(snapshot: Snapshot, reference: References, options: {
    stockAmount: string;
    stockDecimals: number;
    deploymentNonce: number;
    bytecode: string;
}) {
    const referenceHash = validateReferences(reference);
    if (snapshot.version !== 1 || snapshot.chainId !== CHAIN || snapshot.season !== SEASON || snapshot.token !== TOKEN || snapshot.router !== ROUTER || snapshot.referenceHash !== referenceHash || snapshot.passiveThreshold !== reference.passiveThreshold || snapshot.holdingThreshold !== reference.holdingThreshold || snapshot.anchor.timestamp < CLOSE || snapshot.closing.timestamp >= CLOSE || snapshot.opening.timestamp >= OPEN || snapshot.colonySlot !== 930 || snapshot.duration !== BigInt(CLOSE - OPEN))
        throw Error('Invalid final snapshot');
    if (!Number.isInteger(options.stockDecimals) || options.stockDecimals < 0 || options.stockDecimals > 36 || !Number.isSafeInteger(options.deploymentNonce) || options.deploymentNonce < 0 || !/^0x[0-9a-f]+$/i.test(options.bytecode))
        throw Error('Invalid deployment parameters');
    const units = parseUnits(options.stockAmount, options.stockDecimals);
    if (units <= 0n)
        throw Error('Positive prize deposit required');
    const standings = winner(snapshot.nests.map(n => ({ ...n, startPrice: BigInt(reference.stocks.find(s => s.nest === n.nest)!.startPrice), endPrice: BigInt(reference.stocks.find(s => s.nest === n.nest)!.endPrice) })));
    const winning = standings[0].nest, token = STOCKS[winning - 1], distributor = addr(getCreateAddress({ from: TREASURY, nonce: options.deploymentNonce }));
    const excluded = new Set([...EXCLUDED, ...reference.additionalExclusions, distributor].map(addr));
    if (new Set(snapshot.areas.map(([w]) => addr(w))).size !== snapshot.areas.length)
        throw Error('Duplicate holder evidence');
    const allocation = rewards({ stockUnits: units, activeCarry: 0n, passiveCarry: 0n, winner: winning, members: snapshot.members, areas: new Map(snapshot.areas), duration: snapshot.duration, threshold: BigInt(reference.passiveThreshold), excluded });
    const distribution = allocation.rows.length ? tree(CHAIN, distributor, allocation.rows.map(r => ({ wallet: r.wallet, amount: r.total }))) : { root: '0x' + '0'.repeat(64), total: 0n, payments: [] };
    const deployment = await new ContractFactory(PAYOUT_ABI, options.bytecode).getDeployTransaction(token, TREASURY, CLOSE);
    const body = { version: 1, chainId: CHAIN, season: SEASON, treasury: TREASURY, router: ROUTER, token, distributor, opensAt: OPEN, closesAt: CLOSE, stockDecimals: options.stockDecimals, stockUnits: units, referenceHash, snapshotHash: digest(snapshot), snapshotAnchor: snapshot.anchor, standings, allocation, distribution, deployment: { from: TREASURY, nonce: options.deploymentNonce, chainId: CHAIN, data: deployment.data, value: '0x0' } };
    const manifestHash = digest(body), abi = new Interface(PAYOUT_ABI), erc = new Interface(['function approve(address,uint256)']);
    return { ...body, manifestHash, transactions: distribution.total === 0n ? [] : [
            { label: 'approve-exact-prize', from: TREASURY, to: token, chainId: CHAIN, value: '0x0', data: erc.encodeFunctionData('approve', [distributor, distribution.total]) },
            { label: 'fund-immutable-distribution', from: TREASURY, to: distributor, chainId: CHAIN, value: '0x0', data: abi.encodeFunctionData('fund', [distribution.root, manifestHash, distribution.total]) },
        ] };
}
export type Plan = Awaited<ReturnType<typeof prepare>>;
/** Verification is against the complete reviewed inputs, never a loose edited payment list. */
export async function validateBundle(b: any) {
    const plan = await prepare(hydrateSnapshot(b.snapshot), b.references, b.options);
    if (digest(plan) !== digest(b.plan))
        throw Error('Bundle changed: rebuild and review');
    return plan;
}
