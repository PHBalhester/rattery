// Local UI fixture only: no network provider and no valid transaction payloads.
import { mkdirSync, writeFileSync } from 'node:fs';
import { serveOperator } from '../server/settlement/operator.js';
import { TREASURY, STOCKS } from '../server/settlement/config.js';
import type { Plan } from '../server/settlement/plan.js';
import type { JsonRpcProvider } from 'ethers';
const tx = { from: TREASURY, to: STOCKS[0], data: '0x1234', value: '0x0', chainId: 4663 };
const plan = { treasury: TREASURY, token: STOCKS[0], distributor: '0x0000000000000000000000000000000000000123', manifestHash: '0x' + '1'.repeat(64), stockDecimals: 18, stockUnits: '1000000000000000000', allocation: { activeRollover: '1', passiveRollover: '1' }, distribution: { total: '999999999999999998', payments: [{ index: 0 }, { index: 1 }] }, deployment: { from: TREASURY, nonce: 1, chainId: 4663, data: '0x1234', value: '0x0' }, transactions: [{ ...tx, label: 'approve' }, { ...tx, label: 'fund' }] } as unknown as Plan;
const { server, url } = await serveOperator({ fixtureOnly: true, plan }, plan, {} as JsonRpcProvider);
mkdirSync('test-results/settlement', { recursive: true });
writeFileSync('test-results/settlement/operator-url.txt', url);
if ((await fetch('http://127.0.0.1:18871/plan')).status !== 403)
    throw Error('Session gate failed');
if ((await fetch(url, { method: 'POST' })).status !== 403)
    throw Error('Write method accepted');
const response = await fetch(url);
if (!response.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"))
    throw Error('Missing CSP');
console.log('PASS local session capability, GET-only server and CSP');
setTimeout(() => server.close(), 300000).unref();
