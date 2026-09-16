process.env.RATTERY_CHAIN_ID='46630';
process.env.RATTERY_POOL_MANAGER='0x7777777777777777777777777777777777777777';
// Offline test for api/chain.ts and api/trades.ts against a fake JSON-RPC node.
// usage: npx tsx scripts/mock-rpc-test.ts
import http from "node:http";

const TOKEN = "0x1111111111111111111111111111111111111111";
const CURVE = "0x2222222222222222222222222222222222222222";
const BUYER = "0x3333333333333333333333333333333333333333";
const SELLER = "0x4444444444444444444444444444444444444444";
const ROUTER = "0x5555555555555555555555555555555555555555";
const SWAPPER = "0x6666666666666666666666666666666666666666";
const BIRTH = 1000;
const HEAD = 3700;
const TEST_TIME=Math.floor(Date.now()/1000)-40;
const MAX_RANGE = 500; // mock node refuses bigger eth_getLogs ranges

const { TOPIC, PONS, ponsPoolId } = await import("../api/_lib/pons.ts");
const POOL_ID = ponsPoolId(TOKEN);
const pad = (a: string) => "0x" + a.replace(/^0x/, "").padStart(64, "0");
const w = (v: bigint) => (v < 0n ? (1n << 256n) + v : v).toString(16).padStart(64, "0");
const E18 = 10n ** 18n;
const hex = (n: number) => "0x" + n.toString(16);

const logs = [
  { address: PONS.factory, topics: [TOPIC.tokenLaunched, pad(TOKEN), pad(CURVE), pad(BUYER)],
    data: "0x" + w(0n) + w(1n) + w(42n * E18 / 10n), blockNumber: hex(BIRTH), transactionHash: "0xaa", logIndex: "0x0" },
  { address: CURVE, topics: [TOPIC.curveBuy, pad(BUYER), pad(BUYER)],
    data: "0x" + w(5n * E18 / 100n) + w(1234n * E18) + w(1n) + w(0n), blockNumber: hex(1001), transactionHash: "0xb1", logIndex: "0x3" },
  { address: CURVE, topics: [TOPIC.curveSell, pad(SELLER), pad(SELLER)],
    data: "0x" + w(500n * E18) + w(2n * E18 / 100n) + w(1n) + w(0n), blockNumber: hex(1003), transactionHash: "0xb2", logIndex: "0x1" },
  // graduated pool, v4 sign convention: negative = user paid
  { address: PONS.poolManager, topics: [TOPIC.swapV4, POOL_ID, pad(ROUTER)],
    data: "0x" + w(-(E18 / 10n)) + w(1000n * E18) + w(1n) + w(1n) + w(0n) + w(0n), blockNumber: hex(1500), transactionHash: "0xc1", logIndex: "0x7" },
  { address: PONS.poolManager, topics: [TOPIC.swapV4, POOL_ID, pad(ROUTER)],
    data: "0x" + w(3n * E18 / 100n) + w(-300n * E18) + w(1n) + w(1n) + w(0n) + w(0n), blockNumber: hex(1500), transactionHash: "0xc2", logIndex: "0x2" },
  // noise: a swap in someone else's pool and a trade in a later chunk
  { address: PONS.poolManager, topics: [TOPIC.swapV4, pad("0xdead"), pad(ROUTER)],
    data: "0x" + w(-1n) + w(1n) + w(0n) + w(0n) + w(0n) + w(0n), blockNumber: hex(1600), transactionHash: "0xd0", logIndex: "0x0" },
  { address: CURVE, topics: [TOPIC.curveBuy, pad(BUYER), pad(BUYER)],
    data: "0x" + w(E18) + w(1n * E18) + w(0n) + w(0n), blockNumber: hex(2300), transactionHash: "0xe1", logIndex: "0x0" },
];

const faults={graduated:false,missingTimestamp:false,batchRejected:false,rpcError:false,duplicateLogs:false};
let getLogsCalls = 0, rejected = 0;
function handle(c: any) {
  const p = c.params;
  if(faults.rpcError)return {__error:'injected rpc outage'};
  switch (c.method) {
    case "eth_chainId": return "0xb626";
    case "eth_blockNumber": return hex(HEAD);
    case "eth_getLogs": {
      getLogsCalls++;
      const f = p[0]; const from = parseInt(f.fromBlock, 16), to = parseInt(f.toBlock, 16);
      if (to - from + 1 > MAX_RANGE) { rejected++; return { __error: "query exceeds max block range 500" }; }
      return logs.filter((l) => l.address === f.address
        && parseInt(l.blockNumber, 16) >= from && parseInt(l.blockNumber, 16) <= to
        && f.topics.every((t: any, i: number) => t == null || (Array.isArray(t) ? t.includes(l.topics[i]) : t === l.topics[i])));
    }
    case "eth_getTransactionByHash": return { hash: p[0], from: SWAPPER };
    case "eth_getBlockByNumber": if(faults.missingTimestamp)return null; return { timestamp: hex(TEST_TIME+Math.floor((parseInt(p[0],16)-BIRTH)/100)) };
    case "eth_getBalance": return hex(Number(21n * E18 / 10n)); // 2.1 ETH on the curve
    case "eth_call": {
      const d: string = p[0].data;
      if (d === "0x18160ddd") return "0x" + w(1_000_000_000n * E18);
      if (d === "0x313ce567") return "0x" + w(18n);
      if (d === "0x95d89b41" || d === "0x06fdde03")
        return "0x" + w(32n) + w(7n) + Buffer.from("RATTERY").toString("hex").padEnd(64, "0");
      if (d.startsWith("0x70a08231")) {
        const who = "0x" + d.slice(-40);
        return "0x" + w(who === CURVE ? (faults.graduated?0n:600_000_000n * E18) : who === PONS.locker ? 0n : 0n);
      }
      return "0x";
    }
  }
  return { __error: "unknown method " + c.method };
}

const server = http.createServer(async (req, res) => {
 if(req.url?.startsWith('/__fixture')){const q=new URL(req.url,'http://localhost').searchParams;for(const k of Object.keys(faults))faults[k as keyof typeof faults]=q.get(k)==='1';res.setHeader('content-type','application/json');res.end(JSON.stringify(faults));return;}

 if(req.method==='GET'&&(req.url?.startsWith('/api/chain')||req.url?.startsWith('/api/trades'))){
  const path=req.url.startsWith('/api/chain')?'chain':'trades';
  const handler=(await import(`../api/${path}.ts`)).default;
  const query=Object.fromEntries(new URL(req.url,'http://localhost').searchParams);
  const response:any={setHeader:(k:string,v:string)=>res.setHeader(k,v),status:(code:number)=>{res.statusCode=code;return response;},json:(data:unknown)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(data));},end:()=>res.end()};
  return handler({method:'GET',query},response);
 }

  if (req.url?.startsWith("/api/v2/tokens/")) {
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ holders_count: "57" }));
  }
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    const j = JSON.parse(body);
    if(Array.isArray(j)&&faults.batchRejected){res.setHeader('content-type','application/json');res.end(JSON.stringify({error:{message:'batch rejected'}}));return;}

    const one = (c: any) => { const r = handle(c); return r && r.__error ? { jsonrpc: "2.0", id: c.id, error: { message: r.__error } } : { jsonrpc: "2.0", id: c.id, result: r }; };
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(Array.isArray(j) ? j.map(one) : one(j)));
  });
});
await new Promise<void>((r) => server.listen(8788, "0.0.0.0", r));
const port = (server.address() as any).port;

process.env.RATTERY_RPC=`http://127.0.0.1:${port}`;
process.env.RATTERY_BLOCKSCOUT=`http://127.0.0.1:${port}`;
process.env.RATTERY_CA=TOKEN;
process.env.RATTERY_BIRTH_BLOCK=String(BIRTH);
console.log(`PONS V2 SYNTHETIC TESTNET fixture API ready on ${port}`);
