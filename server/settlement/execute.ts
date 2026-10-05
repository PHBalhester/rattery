import { Contract, Interface, JsonRpcProvider, Wallet, Transaction, keccak256, ZeroHash } from 'ethers';
import type { PoolClient } from 'pg';
import { exclusive, bindManifest } from './journal.js';
import { PAYOUT_ABI, CHAIN, TREASURY, ROUTER } from './config.js';
import { addr, CLOSE } from './math.js';
import type { Plan } from './plan.js';
const abi = new Interface(PAYOUT_ABI);
/** Bound concurrent read RPCs; signing and journal writes remain sequential. */
async function readBatches<T, R>(rows: T[], read: (row: T) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < rows.length; i += 12)
        results.push(...await Promise.all(rows.slice(i, i + 12).map(read)));
    return results;
}
const ercABI = ['function balanceOf(address) view returns(uint256)', 'function decimals() view returns(uint8)'];
export interface ExecutionPolicy {
    maxGasPrice: bigint;
    maxGasPerPayment: bigint;
    totalGasBudget: bigint;
    confirmations: number;
}
export const confirmationCount = (head: number, block: number) => head - block + 1;
/** Read-only checks; also used before funding. Exact creation input pins the reviewed implementation. */
export async function verifyDeployment(provider: JsonRpcProvider, p: Plan, deploymentHash: string, confirmations = 20) {
    if (confirmations < 20)
        throw Error('At least 20 confirmations required');
    if (Number((await provider.getNetwork()).chainId) !== p.chainId || p.chainId !== CHAIN)
        throw Error('Wrong network');
    const receipt = await provider.getTransactionReceipt(deploymentHash), tx = await provider.getTransaction(deploymentHash), head = Number(await provider.send('eth_blockNumber', []));
    if (!receipt || receipt.status !== 1 || !receipt.contractAddress || addr(receipt.contractAddress) !== p.distributor || confirmationCount(head, receipt.blockNumber) < confirmations || !tx || tx.to !== null || addr(tx.from) !== TREASURY || tx.nonce !== p.deployment.nonce || tx.data !== p.deployment.data || tx.value !== 0n || Number(tx.chainId) !== CHAIN)
        throw Error('Deployment is missing, unconfirmed or different from reviewed bytecode');
    if ((await provider.getBlock(receipt.blockNumber))?.hash !== receipt.blockHash)
        throw Error('Deployment reorg');
    const c = new Contract(p.distributor, PAYOUT_ABI, provider);
    if (addr(await c.token()) !== p.token || addr(await c.operator()) !== TREASURY || Number(await c.closesAt()) !== CLOSE)
        throw Error('Distributor configuration mismatch');
    const anchor = await provider.getBlock(p.snapshotAnchor.number);
    if (anchor?.hash !== p.snapshotAnchor.hash || anchor.timestamp < CLOSE)
        throw Error('Settlement anchor changed');
    const action = new Contract(ROUTER, ['function colonySlot() view returns(uint32)'], provider);
    if (Number(await action.colonySlot()) !== 930)
        throw Error('Colony checkpoints incomplete');
    const block = await provider.getBlock('latest');
    if (!block || block.timestamp < CLOSE)
        throw Error('Season still open');
    const token = new Contract(p.token, ercABI, provider);
    if (Number(await token.decimals()) !== p.stockDecimals)
        throw Error('Token decimals changed');
    return { c, token, head };
}
export async function status(provider: JsonRpcProvider, p: Plan, deploymentHash: string) {
    const { c, token, head } = await verifyDeployment(provider, p, deploymentHash), root = await c.root({blockTag:head}), hash = await c.manifestHash({blockTag:head});
    if (root !== ZeroHash && (root !== p.distribution.root || hash !== p.manifestHash))
        throw Error('Funded manifest mismatch');
    const paid: number[] = [], pending: number[] = [];
    const flags = await readBatches(p.distribution.payments, row => c.paid(row.index, {blockTag:head}));
    p.distribution.payments.forEach((row, i) => (flags[i] ? paid : pending).push(row.index));
    const paidSet = new Set(paid), expected = p.distribution.payments.filter(r => !paidSet.has(r.index)).reduce((s, r) => s + r.amount, 0n);
    if (root !== ZeroHash && (BigInt(await c.remaining({blockTag:head})) !== expected || BigInt(await token.balanceOf(p.distributor, {blockTag:head})) < expected))
        throw Error('Payout reserve mismatch');
    return { head, funded: root !== ZeroHash, paid, pending, remaining: expected, treasuryBalance: BigInt(await token.balanceOf(TREASURY)) };
}
/** One durable transaction per step. Retry timeout = rebroadcast the identical signed bytes. */
export async function step(db: PoolClient, provider: JsonRpcProvider, signer: Pick<Wallet, 'address' | 'signTransaction'>, p: Plan, deploymentHash: string, policy: ExecutionPolicy, retryIndex?: number) {
    if (policy.confirmations < 20 || policy.maxGasPrice <= 0n || policy.maxGasPerPayment <= 0n || policy.totalGasBudget <= 0n)
        throw Error('Positive gas limits and at least 20 confirmations required');
    const sender = addr(signer.address);
    if (sender === '0xb476efac1611d4e3bc5a01121a15b44676ae496e')
        throw Error('Do not reuse the colony scoring signer');
    return exclusive(db, `settlement-sender:${CHAIN}:${sender}`, () => exclusive(db, `settlement:${CHAIN}:${p.season}`, async () => {
        await db.query('SET synchronous_commit=on');
        if ((await db.query('SHOW fsync')).rows[0].fsync !== 'on')
            throw Error('Durable PostgreSQL storage required');
        await bindManifest(db, p);
        const state = await status(provider, p, deploymentHash);
        if (!state.funded)
            throw Error('Distribution not funded');
        const finalizedContract = new Contract(p.distributor, PAYOUT_ABI, provider);
        if (await finalizedContract.root({ blockTag: state.head - policy.confirmations + 1 }) !== p.distribution.root)
            throw Error('Funding needs more confirmations');
        // Check all previous receipts before any new spend, including rows previously marked final.
        const history = await db.query('SELECT * FROM settlement_transactions WHERE manifest=$1 ORDER BY created_at,attempt', [p.manifestHash]);
        const spent = history.rows.reduce((sum: bigint, row: any) => sum + BigInt(row.gas_budget), 0n);
        await readBatches(history.rows.filter(row => row.state !== 'signed'), async row => {
            const receipt = await provider.getTransactionReceipt(row.hash);
            if (!receipt || receipt.blockHash !== row.receipt_hash || (await provider.getBlock(receipt.blockNumber))?.hash !== receipt.blockHash || confirmationCount(state.head, receipt.blockNumber) < policy.confirmations)
                throw Error('Previously reconciled payment changed; halt for reorg review');
        });
        const signed = history.rows.filter(r => r.state === 'signed');
        if (signed.length > 1)
            throw Error('Multiple unresolved nonces');
        if (signed.length) {
            const row = signed[0], payment = p.distribution.payments.find(r => r.index === row.payment_index);
            if (!payment || row.sender !== sender)
                throw Error('Resume with the original relayer');
            const decoded = Transaction.from(row.raw_transaction);
            if (decoded.hash !== row.hash || decoded.from?.toLowerCase() !== sender || decoded.to?.toLowerCase() !== p.distributor || decoded.chainId !== BigInt(CHAIN) || decoded.value !== 0n || decoded.nonce !== Number(row.nonce) || decoded.data !== abi.encodeFunctionData('pay', [payment.index, payment.wallet, payment.amount, payment.proof]))
                throw Error('Journal transaction differs from the approved payment');
            const receipt = await provider.getTransactionReceipt(row.hash);
            if (receipt) {
                if (receipt.status !== 0 && receipt.status !== 1)
                    throw Error('Unknown receipt status');
                if ((await provider.getBlock(receipt.blockNumber))?.hash !== receipt.blockHash)
                    throw Error('Receipt reorg');
                if (confirmationCount(state.head, receipt.blockNumber) < policy.confirmations)
                    return { state: 'confirming', index: payment.index, hash: row.hash };
                if (receipt.status === 1) {
                    const matches = receipt.logs.filter(l => addr(l.address) === p.distributor).flatMap(l => { try {
                        const e = abi.parseLog(l);
                        return e?.name === 'Paid' ? [e] : [];
                    }
                    catch {
                        return [];
                    } });
                    if (matches.length !== 1 || Number(matches[0].args.index) !== payment.index || addr(matches[0].args.wallet) !== addr(payment.wallet) || matches[0].args.amount !== payment.amount || !state.paid.includes(payment.index))
                        throw Error('Receipt payment mismatch');
                }
                await db.query('UPDATE settlement_transactions SET state=$1,receipt_block=$2,receipt_hash=$3,updated_at=now() WHERE hash=$4', [receipt.status === 1 ? 'confirmed' : 'reverted', receipt.blockNumber, receipt.blockHash, row.hash]);
                return { state: receipt.status === 1 ? 'confirmed' : 'reverted', index: payment.index, hash: row.hash };
            }
            const used = await provider.getTransactionCount(sender, 'latest');
            if (used > Number(row.nonce))
                throw Error('Nonce consumed but receipt unavailable; do not issue another payment');
            if (keccak256(row.raw_transaction) !== row.hash)
                throw Error('Journal hash mismatch');
            try {
                await provider.broadcastTransaction(row.raw_transaction);
            }
            catch { /* Unknown outcome stays signed. The next step queries the same hash. */ }
            return { state: 'pending', index: payment.index, hash: row.hash };
        }
        const last = new Map<number, any>();
        for (const row of history.rows) {
            if (row.state === 'confirmed' && !state.paid.includes(row.payment_index))
                throw Error('Confirmed payout is no longer paid');
            last.set(row.payment_index, row);
        }
        if (retryIndex !== undefined && last.get(retryIndex)?.state !== 'reverted')
            throw Error('Only a confirmed reverted payment can be retried');
        const candidates = p.distribution.payments.filter(r => state.pending.includes(r.index) && (!last.has(r.index) || r.index === retryIndex));
        if (!candidates.length)
            return { state: state.pending.length ? 'needs-review' : 'complete', pending: state.pending };
        let payment = candidates[0], data = '', estimate = 0n;
        const blocked: number[] = [];
        for (const candidate of candidates) {
            data = abi.encodeFunctionData('pay', [candidate.index, candidate.wallet, candidate.amount, candidate.proof]);
            try {
                estimate = await provider.estimateGas({ from: sender, to: p.distributor, data });
                payment = candidate;
                break;
            }
            catch {
                blocked.push(candidate.index);
            }
        }
        if (blocked.length === candidates.length)
            return { state: 'blocked-recipients', pending: blocked };
        const gasPrice = BigInt(await provider.send('eth_gasPrice', []));
        if (gasPrice > policy.maxGasPrice)
            throw Error('Gas price above configured cap');
        const gasLimit = (estimate * 120n + 99n) / 100n;
        if (gasLimit > policy.maxGasPerPayment || spent + gasLimit * gasPrice > policy.totalGasBudget)
            throw Error('Gas budget exceeded');
        if (await provider.getBalance(sender) < gasLimit * gasPrice)
            throw Error('Relayer needs ETH for gas');
        const nonce = await provider.getTransactionCount(sender, 'pending');
        if (nonce !== await provider.getTransactionCount(sender, 'latest'))
            throw Error('Relayer has unrelated pending transactions');
        // Do not reuse an account with pending transactions from another settlement.
        const outstanding = await db.query("SELECT 1 FROM settlement_transactions WHERE chain_id=$1 AND sender=$2 AND state='signed' LIMIT 1", [CHAIN, sender]);
        if (outstanding.rowCount)
            throw Error('Unresolved journal transaction');
        const raw = await signer.signTransaction({ chainId: CHAIN, nonce, to: p.distributor, data, value: 0n, gasLimit, gasPrice, type: 0 }), hash = keccak256(raw);
        await db.query("INSERT INTO settlement_transactions(manifest,payment_index,attempt,chain_id,sender,nonce,hash,raw_transaction,gas_budget,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'signed')", [p.manifestHash, payment.index, (last.get(payment.index)?.attempt ?? 0) + 1, CHAIN, sender, nonce, hash, raw, (gasLimit * gasPrice).toString()]);
        // This only runs after PostgreSQL acknowledges the durable insert.
        try {
            await provider.broadcastTransaction(raw);
        }
        catch { /* Persisted before network I/O; reconciliation owns retry. */ }
        return { state: 'submitted', index: payment.index, hash };
    }));
}
