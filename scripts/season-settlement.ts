import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { JsonRpcProvider, Contract, Wallet } from 'ethers';
import pg from 'pg';
import { collect } from '../server/settlement/collect.js';
import { canonical, digest } from '../server/settlement/manifest.js';
import { prepare, hydrateSnapshot, validateReferences, validateBundle } from '../server/settlement/plan.js';
import { status, step } from '../server/settlement/execute.js';
import { initialize } from '../server/settlement/journal.js';
import { TREASURY, STOCKS } from '../server/settlement/config.js';
import { winner } from '../server/settlement/math.js';
import { safeError } from '../server/settlement/errors.js';
import { serveOperator } from '../server/settlement/operator.js';
const [command, ...args] = process.argv.slice(2);
const read = (file: string) => JSON.parse(readFileSync(resolve(file), 'utf8'));
const save = (file: string, value: unknown) => writeFileSync(resolve(file), canonical(value) + '\n', { flag: 'wx', mode: 0o600 });
const endpoint = () => { const value = process.env.SETTLEMENT_RPC; if (!value || new URL(value).protocol !== 'https:')
    throw Error('SETTLEMENT_RPC must be an HTTPS archive RPC'); return value; };
const need = (v: string | undefined, name: string) => { if (!v)
    throw Error(name + ' required'); return v; };
async function main() {
    if (command === 'collect') {
        const references = read(need(args[0], 'references.json')), hash = validateReferences(references);
        const snapshot = await collect(endpoint(), { ...references, hash }, s => console.log(s));
        save(need(args[1], 'output.json'), snapshot);
        console.log('Snapshot saved; hash', digest(snapshot));
        return;
    }
    if (command === 'prepare') {
        const snapshot = hydrateSnapshot(read(need(args[0], 'snapshot.json'))), references = read(need(args[1], 'references.json')), amount = need(args[2], 'stock token amount'), directory = resolve(need(args[3], 'new output directory'));
        const fundingIndex = args.indexOf('--funding');
        if (fundingIndex < 0) throw Error('Explicit --funding funding.json required for new distributions');
        const prizeFunding = read(need(args[fundingIndex + 1], 'funding.json'));
        if (!prizeFunding || ![prizeFunding.playersUSD, prizeFunding.holdersUSD].every(n => Number.isSafeInteger(n) && n > 0))
            throw Error('Positive integer prize funding required');
        if (existsSync(directory))
            throw Error('Use a new output directory; never overwrite a reviewed manifest');
        const provider = new JsonRpcProvider(endpoint());
        try {
            if (Number((await provider.getNetwork()).chainId) !== 4663)
                throw Error('Wrong network');
            console.log('Rechecking snapshot against the archive RPC at its original anchor');
            const recollected = await collect(endpoint(), { ...references, hash: validateReferences(references) }, s => console.log(s), undefined, snapshot.anchor.number);
            if (digest(recollected) !== digest(snapshot))
                throw Error('Snapshot differs from chain evidence');
            const result = winner(snapshot.nests.map(n => ({ ...n, startPrice: BigInt(references.stocks.find((s: any) => s.nest === n.nest).startPrice), endPrice: BigInt(references.stocks.find((s: any) => s.nest === n.nest).endPrice) })));
            const token = new Contract(STOCKS[result[0].nest - 1], ['function decimals() view returns(uint8)', 'function balanceOf(address) view returns(uint256)'], provider);
            const nonce = await provider.getTransactionCount(TREASURY, 'pending');
            if (nonce !== await provider.getTransactionCount(TREASURY, 'latest'))
                throw Error('Treasury has pending transactions; wait first');
            const solc = process.env.RATTERY_SOLC ?? '/home/phbal/.svm/0.8.24/solc-0.8.24';
            if (!/0\.8\.24/.test(execFileSync(solc, ['--version'], { encoding: 'utf8' })))
                throw Error('Use solc 0.8.24');
            const build = JSON.parse(execFileSync(solc, ['--optimize', '--evm-version', 'paris', '--combined-json', 'abi,bin', 'contracts/SeasonPayout.sol'], { encoding: 'utf8' }));
            const options = { ...(prizeFunding ? { prizeFunding } : {}), stockAmount: amount, stockDecimals: Number(await token.decimals()), deploymentNonce: nonce, bytecode: '0x' + build.contracts['contracts/SeasonPayout.sol:SeasonPayout'].bin };
            const plan = await prepare(snapshot, references, options);
            if (await provider.getCode(plan.distributor) !== '0x')
                throw Error('Predicted distributor address already has code');
            if (BigInt(await token.balanceOf(TREASURY)) < plan.stockUnits)
                throw Error('Treasury has not received the full declared prize deposit');
            mkdirSync(directory, { recursive: true, mode: 0o700 });
            save(directory + '/bundle.json', { snapshot, references, options, plan });
            save(directory + '/transactions.json', { deployment: plan.deployment, funding: plan.transactions });
            writeFileSync(directory + '/payments.csv', 'wallet,active_units,passive_units,total_units\n' + plan.allocation.rows.map(r => [r.wallet, r.active, r.passive, r.total].join(',')).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
            console.log(JSON.stringify({ manifestHash: plan.manifestHash, token: plan.token, recipients: plan.distribution.payments.length, totalUnits: plan.distribution.total.toString(), activeRollover: plan.allocation.activeRollover.toString(), passiveRollover: plan.allocation.passiveRollover.toString(), directory }));
        }
        finally {
            provider.destroy();
        }
        return;
    }
    if (command === 'init-db') {
        const pool = new pg.Pool({ connectionString: need(process.env.SETTLEMENT_DATABASE_URL, 'SETTLEMENT_DATABASE_URL') });
        const db = await pool.connect();
        try {
            await initialize(db);
            console.log('Settlement tables ready');
        }
        finally {
            db.release();
            await pool.end();
        }
        return;
    }
    if (['status', 'run', 'serve'].includes(command)) {
        const bundle = read(need(args[0], 'bundle.json')), plan = await validateBundle(bundle), provider = new JsonRpcProvider(endpoint());
        if (command === 'serve') {
            if (process.env.SETTLEMENT_APPROVED_MANIFEST !== plan.manifestHash)
                throw Error('Review the bundle and set SETTLEMENT_APPROVED_MANIFEST before opening the signing page');
            await serveOperator(bundle, plan, provider);
            return;
        }
        try {
            const deploymentHash = need(args[1], 'deployment transaction hash');
            if (command === 'status') {
                console.log(canonical(await status(provider, plan, deploymentHash)));
                return;
            }
            if (process.env.SETTLEMENT_APPROVED_MANIFEST !== plan.manifestHash)
                throw Error('Review bundle and set SETTLEMENT_APPROVED_MANIFEST to its exact hash');
            let signer: Wallet;
            try {
                signer = new Wallet(need(process.env.SETTLEMENT_RELAYER_KEY, 'SETTLEMENT_RELAYER_KEY'));
            }
            catch {
                throw Error('Configure a valid dedicated SETTLEMENT_RELAYER_KEY in the secret store');
            }
            const policy = { maxGasPrice: BigInt(need(process.env.SETTLEMENT_MAX_GAS_PRICE_WEI, 'SETTLEMENT_MAX_GAS_PRICE_WEI')), maxGasPerPayment: BigInt(need(process.env.SETTLEMENT_MAX_GAS_PER_PAYMENT, 'SETTLEMENT_MAX_GAS_PER_PAYMENT')), totalGasBudget: BigInt(need(process.env.SETTLEMENT_TOTAL_GAS_BUDGET_WEI, 'SETTLEMENT_TOTAL_GAS_BUDGET_WEI')), confirmations: 20 };
            const pool = new pg.Pool({ connectionString: need(process.env.SETTLEMENT_DATABASE_URL, 'SETTLEMENT_DATABASE_URL') });
            const db = await pool.connect();
            try {
                let retry = process.env.SETTLEMENT_RETRY_INDEX === undefined ? undefined : Number(process.env.SETTLEMENT_RETRY_INDEX);
                if (retry !== undefined && (!Number.isSafeInteger(retry) || retry < 0))
                    throw Error('Invalid retry index');
                do {
                    const result = await step(db, provider, signer, plan, deploymentHash, policy, retry);
                    console.log(canonical(result));
                    if (result.state === 'submitted')
                        retry = undefined;
                    if (['complete', 'needs-review', 'blocked-recipients'].includes(result.state) || !args.includes('--watch'))
                        break;
                    await new Promise(r => setTimeout(r, 5000));
                } while (true);
            }
            finally {
                db.release();
                await pool.end();
            }
        }
        finally {
            provider.destroy();
        }
        return;
    }
    throw Error('Usage: collect references.json snapshot.json | prepare snapshot.json references.json AMOUNT NEW_DIRECTORY [--funding funding.json] | init-db | serve bundle.json | status bundle.json DEPLOY_HASH | run bundle.json DEPLOY_HASH [--watch]');
}
main().catch(e => { console.error('Settlement stopped:', safeError(e)); process.exitCode = 1; });
