import assert from 'node:assert/strict';
import { allocate, timeWeighted, rewards, winner, weeklyAdjustment, OPEN, CLOSE } from '../server/settlement/math.js';
import { tree, leaf, verify, digest } from '../server/settlement/manifest.js';
const w = (i: number) => '0x' + i.toString(16).padStart(40, '0');
assert.equal(weeklyAdjustment(10000n, 10200n), 20n);
assert.equal(weeklyAdjustment(10000n, 9800n), -20n);
assert.equal(weeklyAdjustment(2000n, 2001n), 1n);
assert.equal(weeklyAdjustment(2000n, 1999n), -1n);
const t = timeWeighted(new Map([[w(1), 100n]]), [{ block: 1, logIndex: 0, at: 15, from: w(1), to: w(2), units: 100n }], 10, 20);
assert.equal(t.areas.get(w(1)), 500n);
assert.equal(t.areas.get(w(2)), 500n);
assert.equal(t.balances.get(w(1)), 0n);
assert.throws(() => timeWeighted(new Map(), [{ block: 1, logIndex: 0, at: 15, from: w(1), to: w(2), units: 1n }], 10, 20), /Incomplete/);
assert.throws(() => timeWeighted(new Map([[w(1), 1n]]), [{ block: 1, logIndex: 0, at: 20, from: w(1), to: w(2), units: 1n }], 10, 20), /window/);
const split = allocate(10n, new Map([[w(1), 1n], [w(2), 2n]]));
assert.equal(split.amounts.get(w(1)), 3n);
assert.equal(split.amounts.get(w(2)), 6n);
assert.equal(split.rollover, 1n);
for (let n = 1; n < 100; n++) {
    const weights = new Map(Array.from({ length: n }, (_, i) => [w(i + 1), BigInt(i * i + 1)])), total = BigInt(n * 719), r = allocate(total, weights);
    assert.equal([...r.amounts.values()].reduce((a, b) => a + b, 0n) + r.rollover, total);
    assert(r.rollover < BigInt(n));
}
const input = { stockUnits: 1000n, activeCarry: 0n, passiveCarry: 0n, winner: 1 as const, members: [{ wallet: w(1), nest: 1 as const, membership: 2n, contribution: 100n, holdingBonusBps: 0, burnerBonusBps: 500 }, { wallet: w(2), nest: 2 as const, membership: 3n, contribution: 10000n, holdingBonusBps: 500, burnerBonusBps: 500 }], areas: new Map([[w(1), 1000n], [w(2), 1000n]]), duration: 10n, threshold: 100n, excluded: new Set<string>() };
const r = rewards(input);
assert.deepEqual(r.rows.map(x => [x.active, x.passive]), [[800n, 100n], [0n, 100n]]);
const none = rewards({ ...input, members: [], areas: new Map() });
assert.equal(none.activeRollover, 800n);
assert.equal(none.passiveRollover, 200n);
const carry = rewards({ ...input, stockUnits: 0n, activeCarry: 11n, passiveCarry: 13n });
assert.equal(carry.activePool, 11n);
assert.equal(carry.passivePool, 13n);
assert.equal(carry.passiveRollover, 1n);
assert.throws(() => rewards({ ...input, members: [input.members[0], input.members[0]] }), /Multiple/);
assert.throws(() => rewards({ ...input, members: [{ ...input.members[0], burnerBonusBps: 600 }] }), /bonus/);
const exclude = rewards({ ...input, excluded: new Set([w(1)]) });
assert.equal(exclude.activeRollover, 800n);
assert.equal(exclude.rows[0].wallet, w(2));
const standings = ([1, 2, 3] as const).map(nest => ({ nest, halves: 100n, gross: 100n, lastProductionOrder: BigInt(4 - nest), startPrice: 100n, endPrice: 100n }));
assert.equal(winner(standings)[0].nest, 3);
assert.equal(winner(standings.map(r => ({ ...r, gross: 0n })))[0].nest, 1);
assert.equal(winner(standings.map(r => ({ ...r, endPrice: 1n })))[0].finalHalves, 0n);
for (let n = 1; n < 16; n++) {
    const rows = Array.from({ length: n }, (_, i) => ({ wallet: w(i + 1), amount: BigInt(i + 1) })), dist = tree(4663, w(999), rows);
    for (const row of dist.payments) {
        assert(verify(dist.root, leaf(4663, w(999), row.index, row.wallet, row.amount), row.proof));
        assert(!verify(dist.root, leaf(4663, w(998), row.index, row.wallet, row.amount), row.proof));
        assert(!verify(dist.root, leaf(4663, w(999), row.index, row.wallet, row.amount + 1n), row.proof));
    }
    assert.equal(dist.root, tree(4663, w(999), rows.reverse()).root);
}
assert.throws(() => tree(4663, w(999), [{ wallet: w(0), amount: 1n }]), /recipient/);
assert.equal(digest({ a: 1, b: 2n }), digest({ b: 2n, a: 1 }));
assert.equal(CLOSE - OPEN, 155 * 3600);
console.log('PASS: scoring, signed rounding, exact TWAB, thresholds, Season I bonuses, exclusions, switches, no-recipient rollover, dust preservation, conservation and Merkle domain separation');
