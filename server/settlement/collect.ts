import { Interface, id } from 'ethers';
import { readOnlyRPC, blockTag, type ReadRPC } from '../market-io.js';
import { OPEN, CLOSE, addr, timeWeighted, type Nest, type Member, type Transfer } from './math.js';
import { CHAIN, TOKEN, ROUTER, BIRTH_BLOCK, SEASON } from './config.js';
import { digest } from './manifest.js';
const zero = '0x' + '0'.repeat(40);
const tokenABI = new Interface(['event Transfer(address indexed from,address indexed to,uint256 value)', 'function balanceOf(address) view returns(uint256)', 'function totalSupply() view returns(uint256)', 'function decimals() view returns(uint8)']);
const routerABI = new Interface([
    'function token() view returns(address)', 'function season() view returns(bytes32)',
    'function opensAt() view returns(uint64)', 'function closesAt() view returns(uint64)',
    'function colonySlot() view returns(uint32)', 'function nextMembership() view returns(uint256)',
    'function members(address) view returns(uint256 id,uint8 nest)',
    'function contributions(uint256) view returns(uint256)',
    'function nests(uint8) view returns(uint256 score,uint256 gross,uint64 lastProduction,uint64 shieldUntil,uint64 shieldReady,uint64 attackReady,uint8 halfPoint)',
    'event ActionExecuted(bytes32 indexed quoteHash,address indexed wallet,uint256 indexed membership,uint256 nonce,uint8 kind,uint8 nest,uint256 amount,uint256 usdCents,uint256 points,uint256 damage,bool blocked)',
    'event ColonyPoints(uint32 indexed slot,int8 nvda,int8 aapl,int8 amzn)',
]);
export interface Anchor {
    number: number;
    hash: string;
    timestamp: number;
}
export interface Snapshot {
    version: 1;
    chainId: number;
    season: string;
    router: string;
    token: string;
    anchor: Anchor;
    opening: Anchor;
    closing: Anchor;
    colonySlot: number;
    tokenDecimals: number;
    holdingThreshold: string;
    passiveThreshold: string;
    referenceHash: string;
    members: Member[];
    areas: [
        string,
        bigint
    ][];
    duration: bigint;
    nests: {
        nest: Nest;
        halves: bigint;
        gross: bigint;
        lastProductionOrder: bigint;
    }[];
    audit: {
        transfers: number;
        actions: number;
        transferHash: string;
        actionHash: string;
        openingSupply: string;
        closingSupply: string;
    };
}
/** Archive RPC required. This function cannot submit transactions. No partial snapshot is returned. */
export async function collect(endpoint: string, reference: {
    passiveThreshold: string;
    holdingThreshold: string;
    hash: string;
}, progress: (s: string) => void = () => { }, read: ReadRPC = readOnlyRPC(endpoint), anchorNumber?: number): Promise<Snapshot> {
    const passive = BigInt(reference.passiveThreshold), holding = BigInt(reference.holdingThreshold);
    if (passive <= 0n || holding < passive || !/^0x[0-9a-f]{64}$/.test(reference.hash))
        throw Error('Reviewed fixed thresholds required');
    if (Number(await read('eth_chainId', [])) !== CHAIN)
        throw Error('Wrong chain');
    const head = Number(await read('eth_blockNumber', []));
    const block = async (n: number): Promise<Anchor> => { const b = await read('eth_getBlockByNumber', [blockTag(n), false]); if (!b || Number(b.number) !== n || !/^0x[0-9a-f]{64}$/.test(b.hash))
        throw Error('Missing block'); return { number: n, hash: b.hash, timestamp: Number(b.timestamp) }; };
    if (anchorNumber !== undefined && (!Number.isSafeInteger(anchorNumber) || anchorNumber < BIRTH_BLOCK || anchorNumber > head - 20))
        throw Error('Unconfirmed anchor');
    const anchor = await block(anchorNumber ?? head - 20);
    if (anchor.timestamp < CLOSE)
        throw Error('Season still open: final settlement requires the closed season plus 20 blocks');
    const call = async (to: string, abi: Interface, name: string, args: unknown[] = [], tag = anchor.number) => abi.decodeFunctionResult(name, await read('eth_call', [{ to, data: abi.encodeFunctionData(name, args) }, blockTag(tag)]));
    if (addr((await call(ROUTER, routerABI, 'token'))[0]) !== TOKEN || (await call(ROUTER, routerABI, 'season'))[0] !== id(SEASON) || Number((await call(ROUTER, routerABI, 'opensAt'))[0]) !== OPEN || Number((await call(ROUTER, routerABI, 'closesAt'))[0]) !== CLOSE)
        throw Error('Season config mismatch');
    const slots = Number((await call(ROUTER, routerABI, 'colonySlot'))[0]);
    if (slots !== (CLOSE - OPEN) / 600)
        throw Error('Colony checkpoints incomplete');
    const before = async (t: number) => { let lo = BIRTH_BLOCK - 1, hi = anchor.number; while (lo + 1 < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if ((await block(mid)).timestamp < t)
            lo = mid;
        else
            hi = mid;
    } const b = await block(lo), next = await block(lo + 1); if (b.timestamp >= t || next.timestamp < t)
        throw Error('Time boundary mismatch'); return b; };
    const opening = await before(OPEN), closing = await before(CLOSE);
    if (await read('eth_getCode', [TOKEN, blockTag(BIRTH_BLOCK - 1)]) !== '0x')
        throw Error('Token history starts too late');
    const scan = async (address: string, topic: string, from: number, to: number): Promise<any[]> => {
        if (from > to)
            return [];
        let logs: any[];
        try {
            logs = await read('eth_getLogs', [{ address, topics: [topic], fromBlock: blockTag(from), toBlock: blockTag(to) }]);
            if (!Array.isArray(logs) || logs.length >= 1000)
                throw Error('Split range');
        }
        catch (e) {
            if (from === to)
                throw e;
            const mid = Math.floor((from + to) / 2);
            return [...await scan(address, topic, from, mid), ...await scan(address, topic, mid + 1, to)];
        }
        for (const l of logs)
            if (l.removed || addr(l.address) !== address || Number(l.blockNumber) < from || Number(l.blockNumber) > to || l.topics[0] !== topic)
                throw Error('Invalid log');
        return logs;
    };
    progress('Reading complete RATTERY transfer history');
    const transfers = await scan(TOKEN, tokenABI.getEvent('Transfer')!.topicHash, BIRTH_BLOCK, closing.number);
    transfers.sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber) || Number(a.logIndex) - Number(b.logIndex));
    const identities = new Set<string>();
    for (const l of transfers) {
        const k = l.blockNumber + ':' + l.logIndex;
        if (identities.has(k))
            throw Error('Duplicate transfer');
        identities.add(k);
    }
    const balances = new Map<string, bigint>(), qualifiedSince = new Map<string, number>(), burns = new Map<string, bigint>();
    for (const l of transfers) {
        const bn = Number(l.blockNumber);
        if (bn > opening.number)
            break;
        const a = tokenABI.parseLog(l)!.args, from = addr(a.from), to = addr(a.to), n = BigInt(a.value);
        if (from === to)
            continue;
        if (from !== zero) {
            const value = (balances.get(from) ?? 0n) - n;
            if (value < 0n)
                throw Error('Incomplete transfer history');
            balances.set(from, value);
            if (value < holding)
                qualifiedSince.delete(from);
            if (to === zero)
                burns.set(from, (burns.get(from) ?? 0n) + n);
        }
        if (to !== zero) {
            const old = balances.get(to) ?? 0n;
            balances.set(to, old + n);
            if (old < holding && old + n >= holding)
                qualifiedSince.set(to, bn);
        }
    }
    const blocks = new Map<number, Anchor>([[opening.number, opening], [closing.number, closing], [anchor.number, anchor]]);
    const cachedBlock = async (n: number) => { if (!blocks.has(n))
        blocks.set(n, await block(n)); return blocks.get(n)!; };
    const seasonTransfers: Transfer[] = [];
    for (const l of transfers) {
        const bn = Number(l.blockNumber);
        if (bn <= opening.number)
            continue;
        const b = await cachedBlock(bn);
        if (b.hash !== l.blockHash)
            throw Error('Transfer block changed');
        const a = tokenABI.parseLog(l)!.args;
        seasonTransfers.push({ block: bn, logIndex: Number(l.logIndex), at: b.timestamp, from: a.from, to: a.to, units: BigInt(a.value) });
    }
    const twab = timeWeighted(balances, seasonTransfers);
    progress('Reconciling reconstructed balances and supply at both boundaries');
    const reconcile = async (map: Map<string, bigint>, at: number) => {
        const supply = BigInt((await call(TOKEN, tokenABI, 'totalSupply', [], at))[0]);
        if ([...map.values()].reduce((s, n) => s + n, 0n) !== supply)
            throw Error('Supply reconciliation failed');
        const entries = [...map];
        for (let i = 0; i < entries.length; i += 4)
            await Promise.all(entries.slice(i, i + 4).map(async ([w, n]) => { if (BigInt((await call(TOKEN, tokenABI, 'balanceOf', [w], at))[0]) !== n)
                throw Error('Balance reconciliation failed: ' + w); }));
        return supply.toString();
    };
    const openingSupply = await reconcile(balances, opening.number), closingSupply = await reconcile(twab.balances, closing.number);
    const logs = await scan(ROUTER, routerABI.getEvent('ActionExecuted')!.topicHash, opening.number + 1, closing.number);
    logs.sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber) || Number(a.logIndex) - Number(b.logIndex));
    const current = new Map<string, {
        id: bigint;
        nest: Nest;
    }>(), contributions = new Map<bigint, bigint>(), gross = [0n, 0n, 0n], order = [0n, 0n, 0n];
    let nextId = 1n;
    for (const l of logs) {
        const a = routerABI.parseLog(l)!.args, w = addr(a.wallet), kind = Number(a.kind), nest = Number(a.nest) as Nest, membership = BigInt(a.membership), points = BigInt(a.points);
        if (![1, 2, 3].includes(nest))
            throw Error('Unknown nest');
        if (kind === 0) {
            if (membership !== nextId++ || points !== 100n)
                throw Error('Incomplete entry history');
            current.set(w, { id: membership, nest });
            contributions.set(membership, 100n);
        }
        else {
            const m = current.get(w);
            if (!m || m.id !== membership)
                throw Error('Missing membership');
            if (kind === 1) {
                if (m.nest !== nest || points !== 20n)
                    throw Error('Invalid feed');
                contributions.set(membership, (contributions.get(membership) ?? 0n) + 20n);
            }
            else if (![2, 3].includes(kind) || points !== 0n)
                throw Error('Unknown action');
        }
        if (kind === 0 || kind === 1) {
            gross[nest - 1] += points;
            order[nest - 1] = BigInt(l.blockNumber) * 1000000000n + BigInt(l.logIndex);
        }
    }
    if (BigInt((await call(ROUTER, routerABI, 'nextMembership'))[0]) !== nextId)
        throw Error('Membership count mismatch');
    const decimals = Number((await call(TOKEN, tokenABI, 'decimals'))[0]);
    if (decimals < 0 || decimals > 36)
        throw Error('Invalid decimals');
    const members: Member[] = [];
    for (const [wallet, m] of current) {
        const real = await call(ROUTER, routerABI, 'members', [wallet]), c = BigInt((await call(ROUTER, routerABI, 'contributions', [m.id]))[0]);
        if (real.id !== m.id || Number(real.nest) !== m.nest || c !== contributions.get(m.id))
            throw Error('Membership reconciliation failed');
        const since = qualifiedSince.get(wallet), seconds = since === undefined ? 0 : OPEN - (await cachedBlock(since)).timestamp;
        members.push({ wallet, nest: m.nest, membership: m.id, contribution: c, holdingBonusBps: seconds >= 30 * 86400 ? 500 : seconds >= 14 * 86400 ? 300 : seconds >= 7 * 86400 ? 200 : 0, burnerBonusBps: (burns.get(wallet) ?? 0n) >= 1000000n * 10n ** BigInt(decimals) ? 500 : 0 });
    }
    const nests: Snapshot['nests'] = [];
    for (const nest of [1, 2, 3] as const) {
        const n = await call(ROUTER, routerABI, 'nests', [nest]);
        if (n.gross !== gross[nest - 1])
            throw Error('Gross production mismatch');
        nests.push({ nest, halves: n.score * 2n + n.halfPoint, gross: n.gross, lastProductionOrder: order[nest - 1] });
    }
    // Recheck all boundary hashes after the lengthy archive scan, not just the initial head.
    for (const b of [opening, closing, anchor])
        if ((await block(b.number)).hash !== b.hash)
            throw Error('Reorg during collection');
    return { version: 1, chainId: CHAIN, season: SEASON, router: ROUTER, token: TOKEN, anchor, opening, closing, colonySlot: slots, tokenDecimals: decimals, holdingThreshold: holding.toString(), passiveThreshold: passive.toString(), referenceHash: reference.hash, members, areas: [...twab.areas], duration: twab.duration, nests, audit: { transfers: transfers.length, actions: logs.length, transferHash: digest(transfers), actionHash: digest(logs), openingSupply, closingSupply } };
}
