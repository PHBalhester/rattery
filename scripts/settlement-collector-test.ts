import assert from 'node:assert/strict';
import { Interface, id, toQuantity } from 'ethers';
import { collect } from '../server/settlement/collect.js';
import { CHAIN, TOKEN, ROUTER, BIRTH_BLOCK, SEASON } from '../server/settlement/config.js';
import { OPEN, CLOSE } from '../server/settlement/math.js';
const w = (i: number) => '0x' + i.toString(16).padStart(40, '0'), zero = w(0), a = w(100), b = w(200), openBlock = BIRTH_BLOCK + 100, closeBlock = openBlock + CLOSE - OPEN, head = closeBlock + 100;
const tokenABI = new Interface(['event Transfer(address indexed from,address indexed to,uint256 value)', 'function balanceOf(address) view returns(uint256)', 'function totalSupply() view returns(uint256)', 'function decimals() view returns(uint8)']);
const actionABI = new Interface(['function token() view returns(address)', 'function season() view returns(bytes32)', 'function opensAt() view returns(uint64)', 'function closesAt() view returns(uint64)', 'function colonySlot() view returns(uint32)', 'function nextMembership() view returns(uint256)', 'function members(address) view returns(uint256 id,uint8 nest)', 'function contributions(uint256) view returns(uint256)', 'function nests(uint8) view returns(uint256,uint256,uint64,uint64,uint64,uint64,uint8)', 'event ActionExecuted(bytes32 indexed quoteHash,address indexed wallet,uint256 indexed membership,uint256 nonce,uint8 kind,uint8 nest,uint256 amount,uint256 usdCents,uint256 points,uint256 damage,bool blocked)']);
const block = (n: number) => ({ number: toQuantity(n), hash: id('block' + n), timestamp: toQuantity(OPEN + n - openBlock) });
const log = (abi: Interface, event: string, address: string, n: number, index: number, args: any[]) => ({ ...abi.encodeEventLog(abi.getEvent(event)!, args), address, blockNumber: toQuantity(n), blockHash: block(n).hash, logIndex: toQuantity(index), transactionHash: id(n + ':' + index), removed: false });
const transfers = [log(tokenABI, 'Transfer', TOKEN, BIRTH_BLOCK, 0, [zero, a, 2000000n]), log(tokenABI, 'Transfer', TOKEN, BIRTH_BLOCK + 1, 0, [a, zero, 1000000n]), log(tokenABI, 'Transfer', TOKEN, openBlock + (CLOSE - OPEN) / 2, 0, [a, b, 1000000n])];
const event = (n: number, index: number, wallet: string, membership: number, kind: number, nest: number, points: number) => log(actionABI, 'ActionExecuted', ROUTER, n, index, [id('quote' + n + index), wallet, membership, 0, kind, nest, 1, 1000, points, 0, false]);
const actions = [event(openBlock + 1, 0, a, 1, 0, 1, 100), event(openBlock + 2, 0, a, 1, 1, 1, 20), event(openBlock + 3, 0, a, 2, 0, 2, 100), event(openBlock + 4, 0, b, 3, 0, 1, 100)];
const balancesAt = (n: number) => { const m = new Map<string, bigint>(); for (const l of transfers) {
    if (Number(l.blockNumber) > n)
        continue;
    const x = tokenABI.parseLog(l)!.args;
    for (const [wallet, change] of [[x.from, -x.value], [x.to, x.value]] as [
        string,
        bigint
    ][])
        if (wallet !== zero)
            m.set(wallet.toLowerCase(), (m.get(wallet.toLowerCase()) ?? 0n) + change);
} return m; };
function reader(fault = '') {
    let anchorReads = 0;
    return async (method: string, args: any[]): Promise<any> => {
        if (method === 'eth_chainId')
            return toQuantity(CHAIN);
        if (method === 'eth_blockNumber')
            return toQuantity(fault === 'open' ? openBlock + 30 : head);
        if (method === 'eth_getCode')
            return '0x';
        if (method === 'eth_getBlockByNumber') {
            const n = Number(args[0]), v = block(n);
            if (n === head - 20 && ++anchorReads > 1 && fault === 'reorg')
                return { ...v, hash: id('reorg') };
            return v;
        }
        if (method === 'eth_getLogs') {
            const q = args[0], logs = q.address === TOKEN ? transfers : actions;
            return logs.filter(l => Number(l.blockNumber) >= Number(q.fromBlock) && Number(l.blockNumber) <= Number(q.toBlock) && !(fault === 'missing-transfer' && l === transfers[2]) && !(fault === 'missing-feed' && l === actions[1]));
        }
        if (method === 'eth_call') {
            const [q, tag] = args, abi = q.to === TOKEN ? tokenABI : actionABI, x = abi.parseTransaction({ data: q.data })!, name = x.name, n = Number(tag), m = balancesAt(n);
            let values: any[];
            if (q.to === TOKEN) {
                values = name === 'decimals' ? [0] : name === 'balanceOf' ? [m.get(x.args[0].toLowerCase()) ?? 0n] : [[...m.values()].reduce((s, v) => s + v, 0n)];
            }
            else {
                const current: {
                    [k: string]: any[];
                } = { token: [TOKEN], season: [id(SEASON)], opensAt: [OPEN], closesAt: [CLOSE], colonySlot: [fault === 'checkpoint' ? 929 : 930], nextMembership: [4] };
                if (current[name])
                    values = current[name];
                else if (name === 'members')
                    values = x.args[0].toLowerCase() === a ? [2, 2] : [3, 1];
                else if (name === 'contributions')
                    values = [100];
                else {
                    const nest = Number(x.args[0]);
                    values = [nest === 1 ? 220 : nest === 2 ? 100 : 0, nest === 1 ? 220 : nest === 2 ? 100 : 0, 0, 0, 0, 0, 0];
                }
            }
            return abi.encodeFunctionResult(name, values);
        }
        throw Error('Unexpected RPC ' + method);
    };
}
const ref = { passiveThreshold: '1', holdingThreshold: '4', hash: id('reviewed references') };
const snapshot = await collect('unused', ref, () => { }, reader());
assert.equal(snapshot.members.length, 2);
assert.equal(snapshot.members[0].nest, 2);
assert.equal(snapshot.members[0].contribution, 100n);
assert.equal(snapshot.members[0].burnerBonusBps, 500);
assert.equal(snapshot.members[1].burnerBonusBps, 0);
assert.equal(snapshot.nests[0].gross, 220n);
assert.equal(snapshot.areas[0][1], 1000000n * BigInt(CLOSE - OPEN) / 2n);
assert.equal(snapshot.audit.closingSupply, '1000000');
await assert.rejects(collect('unused', ref, () => { }, reader('open')), /still open/);
await assert.rejects(collect('unused', ref, () => { }, reader('checkpoint')), /incomplete/);
await assert.rejects(collect('unused', ref, () => { }, reader('missing-transfer')), /Balance reconciliation/);
await assert.rejects(collect('unused', ref, () => { }, reader('missing-feed')), /Gross production/);
await assert.rejects(collect('unused', ref, () => { }, reader('reorg')), /Reorg/);
console.log('PASS collector: complete history, historical burns, abandoned membership forfeiture, TWAB boundaries, missing transfer/feed rejection, close/checkpoint gates and anchor reorg rejection');
