import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { type JsonRpcProvider } from 'ethers';
import type { Plan } from './plan.js';
import { safeError } from './errors.js';
import { canonical } from './manifest.js';
import { verifyDeployment } from './execute.js';
/** Loopback-only wallet UI. No private keys, public hosting or background signing. */
export async function serveOperator(bundle: unknown, plan: Plan, provider: JsonRpcProvider) {
    const capability = randomBytes(24).toString('hex'), port = 18871, origin = `http://127.0.0.1:${port}`;
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>RATTERY settlement operator</title><link rel="stylesheet" href="/style.css"><main><h1>Season I · Prize distribution</h1><p>Review the exact wallets and token amounts before signing. The wallet pays ETH gas separately.</p><pre id="overview"></pre><details><summary>Contract addresses and exact verification data</summary><pre id="summary"></pre></details><a id="download">Download complete review bundle</a><p id="wallet">Wallet disconnected</p><button id="connect">Connect treasury wallet</button><h2>1. Deploy distributor</h2><p>The deployment nonce is fixed in this plan. Do not send another treasury transaction before deployment.</p><button id="deploy" disabled>Review deployment in wallet</button><h2>2. Verify deployment</h2><input id="hash" placeholder="Deployment transaction hash"><button id="verify">Verify (20 confirmations)</button><h2>3. Authorize and fund</h2><button id="approve" disabled>Approve exact prize amount</button><button id="fund" disabled>Fund immutable distribution</button><p>After funding confirms, the separate relayer delivers each payment. Rollover remains in the treasury. This page does not run swaps or buybacks.</p><pre id="result" role="status"></pre></main><script src="/app.js"></script></html>`;
    const js = `const cap=new URLSearchParams(location.search).get('cap');let p,account,verified=false;const el=id=>document.getElementById(id);const out=value=>el('result').textContent=value;const call=(method,params=[])=>window.ethereum.request({method,params});async function auth(){if(!window.ethereum)throw Error('Open in a browser with your wallet extension');const accounts=await call('eth_accounts');if(accounts[0]?.toLowerCase()!==p.treasury)throw Error('Select the treasury wallet');if(BigInt(await call('eth_chainId'))!==4663n)throw Error('Select Robinhood Chain (4663)');account=accounts[0];}async function send(tx){await auth();const {label,chainId,nonce,...rest}=tx;const request={...rest,from:account,...(nonce===undefined?{}:{nonce:'0x'+nonce.toString(16)})};await call('eth_estimateGas',[request]);return call('eth_sendTransaction',[request]);}function action(id,fn){el(id).onclick=async()=>{el(id).disabled=true;try{await fn();}catch(e){out(e.message||'Wallet request failed');}finally{el(id).disabled=false;}};}fetch('/plan?cap='+cap).then(r=>{if(!r.ok)throw Error('Invalid local session');return r.json()}).then(plan=>{p=plan;const format=value=>{const n=BigInt(value),d=10n**BigInt(p.stockDecimals),tail=(n%d).toString().padStart(p.stockDecimals,'0').replace(/0+$/,'');return (n/d).toString()+(tail?'.'+tail:'');};el('overview').textContent='Prize deposit: '+format(p.stockUnits)+' Stock Tokens\\nTo distribute: '+format(p.distribution.total)+' Stock Tokens\\nRecipients: '+p.distribution.payments.length+'\\nActive rollover: '+format(p.allocation.activeRollover)+'\\nHolder rollover: '+format(p.allocation.passiveRollover);el('summary').textContent=JSON.stringify({manifest:p.manifestHash,treasury:p.treasury,stockToken:p.token,stockDecimals:p.stockDecimals,prizeUnits:p.stockUnits,distributedUnits:p.distribution.total,activeRollover:p.allocation.activeRollover,passiveRollover:p.allocation.passiveRollover,recipients:p.distribution.payments.length},null,2);el('download').href='/bundle?cap='+cap;}).catch(e=>out(e.message));action('connect',async()=>{await call('eth_requestAccounts');await auth();el('wallet').textContent=account;el('deploy').disabled=p.distribution.payments.length===0;});action('deploy',async()=>{await auth();if(await call('eth_getCode',[p.distributor,'latest'])!=='0x')throw Error('Distributor already exists; verify its deployment hash');if(Number(await call('eth_getTransactionCount',[account,'pending']))!==p.deployment.nonce)throw Error('Treasury nonce changed. Rebuild the entire plan before signing.');const hash=await send(p.deployment);el('hash').value=hash;out('Deployment submitted: '+hash);});action('verify',async()=>{const hash=el('hash').value.trim();const r=await fetch('/verify?cap='+cap+'&hash='+encodeURIComponent(hash)),v=await r.json();if(!r.ok)throw Error(v.error);verified=true;el('approve').disabled=v.funded||p.transactions.length===0;el('fund').disabled=v.funded||p.transactions.length===0;out(JSON.stringify(v,null,2));});action('approve',async()=>{if(!verified)throw Error('Verify deployment first');out('Approval submitted: '+await send(p.transactions[0]));});action('fund',async()=>{if(!verified)throw Error('Verify deployment first');out('Funding submitted: '+await send(p.transactions[1])+' — wait for confirmation before starting the relayer.');});`;
    const server = createServer(async (req, res) => {
        res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-store');
        if (req.method !== 'GET' || req.headers.host !== `127.0.0.1:${port}` || (req.headers.origin && req.headers.origin !== origin)) {
            res.writeHead(403);
            res.end();
            return;
        }
        const url = new URL(req.url ?? '/', origin), send = (type: string, value: string) => { res.setHeader('Content-Type', type); res.end(value); };
        try {
            if (url.pathname === '/app.js') {
                send('text/javascript', js);
                return;
            }
            if (url.pathname === '/style.css') {
                send('text/css', "body{background:#11170f;color:#eee6c8;font:16px system-ui;margin:2rem}main{max-width:850px;margin:auto}h1,h2{color:#f0c96b}button,input{padding:.8rem;margin:.3rem;border:1px solid #897441;border-radius:8px;background:#282b1c;color:#eee6c8}button:disabled{opacity:.4}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#1a2117;padding:1rem}a{color:#f0c96b}input{width:80%}");
                return;
            }
            if (url.searchParams.get('cap') !== capability) {
                res.writeHead(403);
                res.end();
                return;
            }
            if (url.pathname === '/') {
                send('text/html', html);
                return;
            }
            if (url.pathname === '/plan') {
                send('application/json', canonical(plan));
                return;
            }
            if (url.pathname === '/bundle') {
                res.setHeader('Content-Disposition', 'attachment; filename="settlement-bundle.json"');
                send('application/json', canonical(bundle));
                return;
            }
            if (url.pathname === '/verify') {
                const hash = url.searchParams.get('hash') ?? '';
                if (!/^0x[0-9a-fA-F]{64}$/.test(hash))
                    throw Error('Invalid deployment hash');
                const { c, token } = await verifyDeployment(provider, plan, hash), root = await c.root();
                if (root !== '0x' + '0'.repeat(64) && (root !== plan.distribution.root || await c.manifestHash() !== plan.manifestHash))
                    throw Error('Funded manifest mismatch');
                const funded = root === plan.distribution.root;
                if (!funded && BigInt(await token.balanceOf(plan.treasury)) < plan.stockUnits)
                    throw Error('Full declared prize deposit is not in the treasury');
                send('application/json', canonical({ verified: true, funded, distributor: plan.distributor, manifest: plan.manifestHash }));
                return;
            }
            res.writeHead(404);
            res.end();
        }
        catch (e) {
            res.writeHead(400);
            send('application/json', JSON.stringify({ error: safeError(e) }));
        }
    });
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
    console.log(`Operator page: ${origin}/?cap=${capability}`);
    return { server, url: `${origin}/?cap=${capability}` };
}
