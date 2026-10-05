import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { Contract, ContractFactory, Interface, JsonRpcProvider, toQuantity, Wallet } from 'ethers';
import pg from 'pg';
import { prepare, validateBundle } from '../server/settlement/plan.js';
import { digest } from '../server/settlement/manifest.js';
import { step, status } from '../server/settlement/execute.js';
import { initialize, exclusive, bindManifest } from '../server/settlement/journal.js';
import { CHAIN, TOKEN, ROUTER, TREASURY, SEASON, STOCKS, PAYOUT_ABI } from '../server/settlement/config.js';
import { OPEN, CLOSE } from '../server/settlement/math.js';
const url = 'http://127.0.0.1:18767'; // All writes are to this verified local Anvil, never a caller-supplied RPC.
const solc = process.env.RATTERY_SOLC ?? '/home/phbal/.svm/0.8.24/solc-0.8.24';
assert.match(execFileSync(solc, ['--version'], { encoding: 'utf8' }), /0\.8\.24/);
const build = JSON.parse(execFileSync(solc, ['--optimize', '--evm-version', 'paris', '--combined-json', 'abi,bin,bin-runtime', 'contracts/SeasonPayout.sol', 'contracts/test/PayoutTestToken.sol'], { encoding: 'utf8' })).contracts;
const artifact = build['contracts/SeasonPayout.sol:SeasonPayout'], mock = build['contracts/test/PayoutTestToken.sol:PayoutTestToken'], action = build['contracts/test/PayoutTestToken.sol:PayoutActionMock'];
const child = spawn(process.env.RATTERY_ANVIL ?? '/home/phbal/Rattery/.tools/foundry/anvil', ['--host', '127.0.0.1', '--port', '18767', '--chain-id', '4663', '--timestamp', String(CLOSE - 3600), '--silent'], { stdio: 'ignore' });
const provider = new JsonRpcProvider(url, undefined, { cacheTimeout: -1 });
let connected = false, pool: pg.Pool | undefined, db: pg.PoolClient | undefined, schema = '';
async function rpc(method: string, params: any[] = []) { if (!connected && !['eth_chainId', 'web3_clientVersion'].includes(method))
    throw Error('Local chain not verified'); return provider.send(method, params); }
async function send(from: string, to: string | undefined, data: string) { const hash = await rpc('eth_sendTransaction', [{ from, ...(to ? { to } : {}), data, gas: '0x7a1200' }]); return (await provider.getTransactionReceipt(hash))!; }
try {
    for (let i = 0; i < 60; i++) {
        try {
            assert.equal(Number(await rpc('eth_chainId')), 4663);
            assert.match(await rpc('web3_clientVersion'), /anvil/i);
            connected = true;
            break;
        }
        catch {
            await new Promise(r => setTimeout(r, 100));
        }
    }
    assert(connected, 'Local Anvil unavailable');
    assert(child.exitCode === null, 'Anvil port was occupied');
    const [owner, a, b] = await rpc('eth_accounts');
    const tokenABI = new Interface(mock.abi), abi = new Interface(PAYOUT_ABI);
    await rpc('evm_setNextBlockTimestamp', [CLOSE + 60]);
    await rpc('evm_mine');
    await rpc('anvil_setCode', [STOCKS[0], '0x' + mock['bin-runtime']]);
    await rpc('anvil_setCode', [ROUTER, '0x' + action['bin-runtime']]);
    await rpc('anvil_impersonateAccount', [TREASURY]);
    await rpc('anvil_setNonce', [TREASURY, '0x1']);
    await rpc('anvil_setBalance', [TREASURY, toQuantity(10n ** 20n)]);
    const anchor = await provider.getBlock('latest');
    assert(anchor);
    const references = { version: 1 as const, season: SEASON, passiveThreshold: '1', holdingThreshold: '4', thresholdEvidence: 'local fixture only', stocks: ([1, 2, 3] as const).map(nest => ({ nest, startPrice: '100', endPrice: '100', startSession: '2026-09-25', endSession: '2026-10-02', evidence: 'local fixture only', splitAdjusted: true as const })), additionalExclusions: [] };
    const snapshot = { version: 1 as const, chainId: CHAIN, season: SEASON, router: ROUTER, token: TOKEN, anchor: { number: anchor.number, hash: anchor.hash!, timestamp: anchor.timestamp }, opening: { number: 0, hash: anchor.hash!, timestamp: OPEN - 1 }, closing: { number: 0, hash: anchor.hash!, timestamp: CLOSE - 1 }, colonySlot: 930, tokenDecimals: 18, holdingThreshold: '4', passiveThreshold: '1', referenceHash: digest(references), members: [{ wallet: a, nest: 1 as const, membership: 1n, contribution: 100n, holdingBonusBps: 0, burnerBonusBps: 0 }], areas: [[a, BigInt(CLOSE - OPEN)], [b, BigInt(CLOSE - OPEN)]] as [
            string,
            bigint
        ][], duration: BigInt(CLOSE - OPEN), nests: ([1, 2, 3] as const).map(nest => ({ nest, halves: nest === 1 ? 200n : 0n, gross: nest === 1 ? 100n : 0n, lastProductionOrder: nest === 1 ? 1n : 0n })), audit: { transfers: 0, actions: 1, transferHash: digest([]), actionHash: digest([]), openingSupply: '0', closingSupply: '0' } };
    const options = { prizeFunding: {playersUSD:1000,holdersUSD:300}, stockAmount: '0.000000000000001001', stockDecimals: 18, deploymentNonce: 1, bytecode: '0x' + artifact.bin };
    const plan = await prepare(snapshot, references, options), bundle = { snapshot, references, options, plan };
    await validateBundle(bundle);
    assert.equal(plan.allocation.activePool, 770n);
    assert.equal(plan.allocation.passivePool, 231n);
    await assert.rejects(validateBundle({...bundle,options:{...options,prizeFunding:{playersUSD:80,holdersUSD:20}}}),/changed/);
    await assert.rejects(validateBundle({ ...bundle, plan: { ...plan, stockUnits: 1002n } }), /changed/);
    await assert.rejects(prepare({ ...snapshot, colonySlot: 929 }, references, options), /snapshot/);
    const deploy = await send(TREASURY, undefined, plan.deployment.data);
    assert.equal(deploy.status, 1);
    assert.equal(deploy.contractAddress!.toLowerCase(), plan.distributor);
    const c = new Contract(plan.distributor, PAYOUT_ABI, provider), token = new Contract(STOCKS[0], mock.abi, provider);
    const invoke = async (from: string, to: string, i: Interface, name: string, args: any[] = []) => send(from, to, i.encodeFunctionData(name, args));
    const fund = async () => { await invoke(owner, STOCKS[0], tokenABI, 'mint', [TREASURY, plan.stockUnits]); await invoke(TREASURY, STOCKS[0], tokenABI, 'approve', [plan.distributor, plan.distribution.total]); return invoke(TREASURY, plan.distributor, abi, 'fund', [plan.distribution.root, plan.manifestHash, plan.distribution.total]); };
    const check = async (name: string, fn: () => Promise<void>) => { const snap = await rpc('evm_snapshot'); try {
        await fn();
        console.log('PASS', name);
    }
    finally {
        await rpc('evm_revert', [snap]);
    } };
    const row = plan.distribution.payments[0], payArgs = [row.index, row.wallet, row.amount, row.proof];
    await check('funding only by treasury; exact amount; immutable root', async () => { assert.equal((await invoke(owner, plan.distributor, abi, 'fund', [plan.distribution.root, plan.manifestHash, 1])).status, 0); assert.equal((await fund()).status, 1); assert.equal(await c.remaining(), plan.distribution.total); assert.equal(await token.balanceOf(TREASURY), plan.stockUnits - plan.distribution.total); assert.equal((await fund()).status, 0); });
    await check('permissionless delivery, exact balances, duplicate and altered proof rejected', async () => { await fund(); const before = await token.balanceOf(row.wallet); assert.equal((await invoke(owner, plan.distributor, abi, 'pay', payArgs)).status, 1); assert.equal(await token.balanceOf(row.wallet), before + row.amount); assert.equal(await c.paid(row.index), true); assert.equal((await invoke(owner, plan.distributor, abi, 'pay', payArgs)).status, 0); const other = plan.distribution.payments[1]; assert.equal((await invoke(owner, plan.distributor, abi, 'pay', [other.index, other.wallet, other.amount + 1n, other.proof])).status, 0); assert.equal(await c.paid(other.index), false); });
    await check('blocked recipient and transfer-tax rollback preserve the unpaid entitlement', async () => { await fund(); await invoke(owner, STOCKS[0], tokenABI, 'setBlocked', [row.wallet, true]); assert.equal((await invoke(owner, plan.distributor, abi, 'pay', payArgs)).status, 0); assert.equal(await c.remaining(), plan.distribution.total); assert.equal(await c.paid(row.index), false); await invoke(owner, STOCKS[0], tokenABI, 'setBlocked', [row.wallet, false]); await invoke(owner, STOCKS[0], tokenABI, 'setFailure', [true, false]); assert.equal((await invoke(owner, plan.distributor, abi, 'pay', payArgs)).status, 0); assert.equal(await c.paid(row.index), false); await invoke(owner, STOCKS[0], tokenABI, 'setFailure', [false, true]); assert.equal((await invoke(owner, plan.distributor, abi, 'pay', payArgs)).status, 0); });
    await check('token reentry cannot deliver a second leaf during another payment', async () => { await fund(); const other = plan.distribution.payments[1]; await invoke(owner, STOCKS[0], tokenABI, 'setReentry', [plan.distributor, abi.encodeFunctionData('pay', [other.index, other.wallet, other.amount, other.proof])]); assert.equal((await invoke(owner, plan.distributor, abi, 'pay', payArgs)).status, 1); assert.equal(await c.paid(row.index), true); assert.equal(await c.paid(other.index), false); assert.equal(await c.remaining(), other.amount); });
    await check('fee-on-transfer funding rejected without setting root', async () => { await invoke(owner, STOCKS[0], tokenABI, 'setFailure', [true, false]); assert.equal((await fund()).status, 0); assert.equal(await c.root(), '0x' + '0'.repeat(64)); });
    await check('funding before close is rejected', async () => { const future = await new ContractFactory(artifact.abi, artifact.bin).getDeployTransaction(STOCKS[0], TREASURY, CLOSE + 100000); const receipt = await send(TREASURY, undefined, future.data); assert.equal((await invoke(TREASURY, receipt.contractAddress!, abi, 'fund', [plan.distribution.root, plan.manifestHash, 1n])).status, 0); });
    // Real PostgreSQL, restricted to an isolated schema in a database explicitly ending in _test.
    pool = new pg.Pool();
    db = await pool.connect();
    const database = (await db.query('SELECT current_database() AS name')).rows[0].name;
    assert(database.endsWith('_test'), 'Tests require a database ending in _test');
    schema = 'settlement_test_' + process.pid;
    await db.query(`CREATE SCHEMA ${schema}`);
    await db.query(`SET search_path TO ${schema}`);
    await initialize(db);
    const second = await pool.connect();
    try {
        await second.query(`SET search_path TO ${schema}`);
        await exclusive(db, 'local-concurrency-test', async () => { await assert.rejects(exclusive(second, 'local-concurrency-test', async () => { }), /already running/); });
    }
    finally {
        second.release();
    }
    await bindManifest(db, plan);
    await assert.rejects(bindManifest(db, { ...plan, manifestHash: digest('different') }), /different distribution/);
    console.log('PASS journal exclusivity and one distribution per season');
    await fund();
    await rpc('anvil_mine', ['0x15']);
    const relayer = Wallet.createRandom();
    await rpc('anvil_setBalance', [relayer.address, toQuantity(10n ** 19n)]);
    const journalBase = await rpc('evm_snapshot');
    const policy = { maxGasPrice: 100000000000n, maxGasPerPayment: 500000n, totalGasBudget: 10n ** 18n, confirmations: 20 };
    await assert.rejects(step(db, provider, relayer, plan, deploy.hash, { ...policy, totalGasBudget: 1n }), /budget/);
    const broadcast = provider.broadcastTransaction.bind(provider);
    let broadcasts = 0;
    provider.broadcastTransaction = async (raw) => { broadcasts++; const saved = await db!.query('SELECT * FROM settlement_transactions WHERE hash=$1', [(await import('ethers')).keccak256(raw as string)]); assert.equal(saved.rowCount, 1, 'Signed bytes must be committed BEFORE broadcast'); throw Error('Simulated network interruption before broadcast'); };
    const first = await step(db, provider, relayer, plan, deploy.hash, policy);
    assert.equal(first.state, 'submitted');
    assert.equal(await c.paid(row.index), false);
    assert.equal(broadcasts, 1);
    provider.broadcastTransaction = async (raw) => { await broadcast(raw); throw Error('Simulated lost broadcast response'); };
    assert.equal((await step(db, provider, relayer, plan, deploy.hash, policy)).state, 'pending');
    await rpc('anvil_mine', ['0x15']);
    provider.broadcastTransaction = broadcast;
    assert.equal((await step(db, provider, relayer, plan, deploy.hash, policy)).state, 'confirmed');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM settlement_transactions')).rows[0].n, 1);
    assert.equal((await step(db, provider, relayer, plan, deploy.hash, policy)).state, 'submitted');
    await rpc('anvil_mine', ['0x15']);
    assert.equal((await step(db, provider, relayer, plan, deploy.hash, policy)).state, 'confirmed');
    assert.equal((await step(db, provider, relayer, plan, deploy.hash, policy)).state, 'complete');
    assert.equal((await step(db, provider, relayer, plan, deploy.hash, policy)).state, 'complete');
    assert.equal(await c.remaining(), 0n);
    const final = await status(provider, plan, deploy.hash);
    assert.equal(final.pending.length, 0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM settlement_transactions')).rows[0].n, 2);
    await rpc('evm_revert', [journalBase]);
    await db.query('DELETE FROM settlement_transactions');
    const journalCase = async (name: string, fn: () => Promise<void>) => { const snap = await rpc('evm_snapshot'); try {
        await fn();
        console.log('PASS', name);
    }
    finally {
        provider.broadcastTransaction = broadcast;
        await rpc('evm_revert', [snap]);
        await db!.query('DELETE FROM settlement_transactions');
    } };
    await journalCase('one blocked recipient does not prevent other recipients receiving their allocation', async () => {
        await invoke(owner, STOCKS[0], tokenABI, 'setBlocked', [row.wallet, true]);
        const sent = await step(db!, provider, relayer, plan, deploy.hash, policy);
        assert.equal(sent.state, 'submitted');
        assert.notEqual('index' in sent ? sent.index : null, row.index);
        await rpc('anvil_mine', ['0x15']);
        await step(db!, provider, relayer, plan, deploy.hash, policy);
        assert.equal((await step(db!, provider, relayer, plan, deploy.hash, policy)).state, 'blocked-recipients');
        assert.equal(await c.paid(row.index), false);
    });
    await journalCase('confirmed revert is reserved, other payments continue, explicit retry succeeds once', async () => {
        provider.broadcastTransaction = async (raw) => { await invoke(owner, STOCKS[0], tokenABI, 'setBlocked', [row.wallet, true]); return broadcast(raw); };
        assert.equal((await step(db!, provider, relayer, plan, deploy.hash, policy)).state, 'submitted');
        provider.broadcastTransaction = broadcast;
        await rpc('anvil_mine', ['0x15']);
        assert.equal((await step(db!, provider, relayer, plan, deploy.hash, policy)).state, 'reverted');
        assert.equal((await step(db!, provider, relayer, plan, deploy.hash, policy)).state, 'submitted');
        await rpc('anvil_mine', ['0x15']);
        await step(db!, provider, relayer, plan, deploy.hash, policy);
        assert.equal((await step(db!, provider, relayer, plan, deploy.hash, policy)).state, 'needs-review');
        await invoke(owner, STOCKS[0], tokenABI, 'setBlocked', [row.wallet, false]);
        assert.equal((await step(db!, provider, relayer, plan, deploy.hash, policy, row.index)).state, 'submitted');
        await rpc('anvil_mine', ['0x15']);
        assert.equal((await step(db!, provider, relayer, plan, deploy.hash, policy)).state, 'confirmed');
        assert.equal((await step(db!, provider, relayer, plan, deploy.hash, policy)).state, 'complete');
    });
    await journalCase('consumed nonce with unknown receipt halts instead of making a new payment', async () => {
        provider.broadcastTransaction = async () => { throw Error('offline'); };
        await step(db!, provider, relayer, plan, deploy.hash, policy);
        const nonce = await provider.getTransactionCount(relayer.address);
        await rpc('anvil_setNonce', [relayer.address, toQuantity(nonce + 1)]);
        await assert.rejects(step(db!, provider, relayer, plan, deploy.hash, policy), /Nonce consumed/);
    });
    await journalCase('deep reorg of a previously confirmed payment halts execution', async () => {
        const before = await rpc('evm_snapshot');
        await step(db!, provider, relayer, plan, deploy.hash, policy);
        await rpc('anvil_mine', ['0x15']);
        await step(db!, provider, relayer, plan, deploy.hash, policy);
        await rpc('evm_revert', [before]);
        await assert.rejects(step(db!, provider, relayer, plan, deploy.hash, policy), /reorg review/);
    });
    console.log('PASS real PostgreSQL + EVM: gas caps, persisted-before-broadcast, two network interruption modes, restart reconciliation, finality, all recipients delivered once, completed run is idempotent');
}
finally {
    if (db) {
        if (schema) {
            await db.query('SET search_path TO public');
            await db.query(`DROP SCHEMA ${schema} CASCADE`);
        }
        db.release();
    }
    await pool?.end();
    provider.destroy();
    child.kill('SIGTERM');
}
