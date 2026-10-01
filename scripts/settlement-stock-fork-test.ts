import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { AbiCoder, Contract, ContractFactory, Interface, JsonRpcProvider, id, keccak256, toBeHex, toQuantity } from 'ethers';
import { STOCKS, TREASURY, PAYOUT_ABI } from '../server/settlement/config.js';
import { tree } from '../server/settlement/manifest.js';
// The public connection is a strict READ-ONLY proxy. Every write targets local Anvil.
const allowed = new Set(['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getBlockByHash', 'eth_getBalance', 'eth_getTransactionCount', 'eth_getCode', 'eth_getStorageAt', 'eth_getProof', 'eth_getTransactionByHash', 'eth_getTransactionReceipt', 'eth_call', 'eth_gasPrice', 'net_version', 'web3_clientVersion']);
let reads = 0;
async function upstream(method: string, params: any[] = []) { if (!allowed.has(method) || ++reads > 3000)
    throw Error('Read-only budget/method denied'); const response = await fetch('https://rpc.mainnet.chain.robinhood.com/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(20000) }); if (!response.ok)
    throw Error('Public read HTTP ' + response.status); const value = await response.json(); if (value.error)
    throw Error(value.error.message); return value.result; }
const forkBlock = Number(await upstream('eth_blockNumber')) - 20, anchor = await upstream('eth_getBlockByNumber', [toQuantity(forkBlock), false]);
assert.equal(Number(await upstream('eth_chainId')), 4663);
const proxy = createServer(async (req, res) => { try {
    let body = '';
    for await (const chunk of req) {
        body += chunk;
        if (body.length > 65536)
            throw Error('Large request');
    }
    const input = JSON.parse(body);
    const one = async (x: any) => { try {
        return { jsonrpc: '2.0', id: x.id, result: await upstream(x.method, x.params) };
    }
    catch (e) {
        return { jsonrpc: '2.0', id: x.id, error: { code: -32601, message: e instanceof Error ? e.message : 'read error' } };
    } };
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(Array.isArray(input) ? await Promise.all(input.map(one)) : await one(input)));
}
catch {
    res.writeHead(400);
    res.end('{}');
} });
await new Promise<void>(r => proxy.listen(18769, '127.0.0.1', r));
const artifact = JSON.parse(execFileSync(process.env.RATTERY_SOLC ?? '/home/phbal/.svm/0.8.24/solc-0.8.24', ['--optimize', '--evm-version', 'paris', '--combined-json', 'abi,bin', 'contracts/SeasonPayout.sol'], { encoding: 'utf8' })).contracts['contracts/SeasonPayout.sol:SeasonPayout'];
const child = spawn(process.env.RATTERY_ANVIL ?? '/home/phbal/Rattery/.tools/foundry/anvil', ['--host', '127.0.0.1', '--port', '18770', '--chain-id', '31337', '--fork-url', 'http://127.0.0.1:18769', '--fork-block-number', String(forkBlock), '--no-storage-caching', '--silent'], { stdio: 'ignore' });
const provider = new JsonRpcProvider('http://127.0.0.1:18770', undefined, { cacheTimeout: -1 });
let verified = false;
async function rpc(method: string, params: any[] = []) { if (!verified && !['eth_chainId', 'web3_clientVersion'].includes(method))
    throw Error('Unverified local chain'); return provider.send(method, params); }
try {
    for (let i = 0; i < 100; i++) {
        try {
            assert.equal(Number(await rpc('eth_chainId')), 31337);
            assert.match(await rpc('web3_clientVersion'), /anvil/i);
            verified = true;
            break;
        }
        catch {
            await new Promise(r => setTimeout(r, 100));
        }
    }
    assert(verified && child.exitCode === null);
    await rpc('anvil_impersonateAccount', [TREASURY]);
    await rpc('anvil_setBalance', [TREASURY, toQuantity(10n ** 20n)]);
    const abi = new Interface(['function balanceOf(address) view returns(uint256)', 'function approve(address,uint256) returns(bool)']);
    const send = async (to: string | undefined, data: string) => { const hash = await rpc('eth_sendTransaction', [{ from: TREASURY, ...(to ? { to } : {}), data, gas: '0x7a1200' }]); let receipt = await provider.getTransactionReceipt(hash); for (let i = 0; !receipt && i < 100; i++) {
        await new Promise(r => setTimeout(r, 100));
        receipt = await provider.getTransactionReceipt(hash);
    } assert.equal(receipt?.status, 1); return receipt!; };
    const encode = AbiCoder.defaultAbiCoder();
    const namespace = BigInt(keccak256(encode.encode(['uint256'], [BigInt(id('openzeppelin.storage.ERC20')) - 1n]))) & ~255n;
    for (const [i, address] of STOCKS.entries()) {
        const before = await rpc('evm_snapshot'), token = new Contract(address, abi, provider), code = await provider.getCode(address);
        assert.notEqual(code, '0x');
        let found = false;
        for (const slot of [...Array.from({ length: 24 }, (_, n) => BigInt(n)), namespace]) {
            const snapshot = await rpc('evm_snapshot'), key = keccak256(encode.encode(['address', 'uint256'], [TREASURY, slot]));
            await rpc('anvil_setStorageAt', [address, key, toBeHex(1000000000000n, 32)]);
            if (BigInt(await token.balanceOf(TREASURY)) === 1000000000000n) {
                found = true;
                break;
            }
            await rpc('evm_revert', [snapshot]);
        }
        assert(found, 'Could not locate synthetic local balance slot');
        const current = await provider.getBlock('latest');
        assert(current);
        const deployTx = await new ContractFactory(artifact.abi, artifact.bin).getDeployTransaction(address, TREASURY, current.timestamp);
        const deployed = await send(undefined, deployTx.data), distributor = deployed.contractAddress!;
        const payout = tree(31337, distributor, [{ wallet: '0x0000000000000000000000000000000000000123', amount: 600n }, { wallet: '0x0000000000000000000000000000000000000456', amount: 400n }]), payoutABI = new Interface(PAYOUT_ABI);
        await send(address, abi.encodeFunctionData('approve', [distributor, payout.total]));
        await send(distributor, payoutABI.encodeFunctionData('fund', [payout.root, id('local fork only'), payout.total]));
        for (const row of payout.payments) {
            const balance = BigInt(await token.balanceOf(row.wallet));
            await send(distributor, payoutABI.encodeFunctionData('pay', [row.index, row.wallet, row.amount, row.proof]));
            assert.equal(BigInt(await token.balanceOf(row.wallet)), balance + row.amount);
        }
        console.log(JSON.stringify({ test: 'Stock Token fork distribution', symbol: ['NVDA', 'AAPL', 'AMZN'][i], address, forkBlock, blockHash: anchor.hash, codeHash: keccak256(code), result: 'PASS', publicWrites: 0, syntheticLocalBalance: true }));
        await rpc('evm_revert', [before]);
    }
}
finally {
    provider.destroy();
    child.kill('SIGTERM');
    await new Promise<void>(r => proxy.close(() => r()));
}
