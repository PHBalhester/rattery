declare const process: {env:Record<string,string|undefined>};
// Pons V2 on Robinhood Chain (chainId 4663).
//
// Lifecycle of a Pons V2 token:
//   1. TokenLaunched on the factory. The whole 1B supply is minted into a
//      per-token bonding-curve contract. Trades are CurveBuy / CurveSell there.
//   2. When the curve has taken in its graduation threshold (4.2 ETH for a
//      native-ETH launch) it is swept, and a Uniswap v4 pool is created behind
//      the PonsV2MemeHook (fee 0, tickSpacing 200, currency0 = native ETH).
//   3. After that, trades are Swap events on the chain-wide v4 PoolManager,
//      filtered by the pool's PoolId.
//
// Addresses and topic0 values from Bitquery's Pons V2 reference (verified by
// them against verified sources and live logs). Topic0 values were re-derived
// here with our own keccak and match.
import { keccak256, keccakText, hexToBytes } from "./keccak.js";
import { ENV, rpc, normAddr, getLogs, padTopic, topicAddr, word, wordSigned, toFloat, type Log } from "./eth.js";

export const PONS = {
  get factory(){return ENV.chainId===46630?"0x50230537574fdae0ff3550bb76c1d6733d6515a8":"0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e";},
  get hook(){return ENV.chainId===46630?"0x3860c84b297778e48cf6de8dea5f965f25b2a044":"0xe5e702641ea86f4ae6cc3cdaed2b886f976be044";},
  get locker(){return ENV.chainId===46630?"0x566a6e1c11bdbd7806ce92100d84422f52cb4c46":"0x267444d099b10fb5ed7c3cc7b7c767adca574952";},
  get poolManager(){const override=normAddr(process.env.RATTERY_POOL_MANAGER);if(override)return override;if(ENV.chainId===46630)throw new Error('Set verified RATTERY_POOL_MANAGER for testnet');return "0x8366a39cc670b4001a1121b8f6a443a643e40951";},
  poolFee: 0,
  tickSpacing: 200,
  nativeEth: "0x0000000000000000000000000000000000000000",
} as const;

export const TOPIC = {
  tokenLaunched: keccakText("TokenLaunched(address,address,address,address,uint256,uint256)"),
  curveBuy: keccakText("CurveBuy(address,address,uint256,uint256,uint256,uint256)"),
  curveSell: keccakText("CurveSell(address,address,uint256,uint256,uint256,uint256)"),
  poolGraduated: keccakText("PoolGraduated(address,uint256,uint256,uint256)"),
  swapV4: keccakText("Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)"),
  initializeV4: keccakText("Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)"),
};

/**
 * PoolId = keccak256(abi.encode(PoolKey)). For a native-ETH Pons launch the
 * key is (0x0, token, 0, 200, hook), so the id is known before graduation.
 */
export function ponsPoolId(token: string, quote: string = PONS.nativeEth): string {
  const [c0, c1] = quote.toLowerCase() < token.toLowerCase() ? [quote, token] : [token, quote];
  const words = [
    c0.replace(/^0x/, "").padStart(64, "0"),
    c1.replace(/^0x/, "").padStart(64, "0"),
    PONS.poolFee.toString(16).padStart(64, "0"),
    PONS.tickSpacing.toString(16).padStart(64, "0"),
    PONS.hook.replace(/^0x/, "").padStart(64, "0"),
  ];
  return keccak256(hexToBytes(words.join("")));
}

/** Read a verified v4 Initialize log before classifying a pool as a token market. */
export function inspectPool(l: Log, token: string) {
  if (l.address.toLowerCase() !== PONS.poolManager || l.topics[0]?.toLowerCase() !== TOPIC.initializeV4
      || l.topics.length !== 4 || !l.topics.every(t => /^0x[0-9a-fA-F]{64}$/.test(t)) || !/^0x[0-9a-fA-F]{320}$/.test(l.data)) throw new Error("Malformed pool initialization");
  const currency0 = topicAddr(l.topics[2]), currency1 = topicAddr(l.topics[3]);
  const normalized = normAddr(token);
  if (!normalized || (normalized !== currency0 && normalized !== currency1)) throw new Error("Pool does not contain token");
  const fee = word(l.data, 0), spacing = wordSigned(l.data, 1), hook = topicAddr("0x" + word(l.data, 2).toString(16).padStart(64, "0"));
  if (currency0 >= currency1 || fee > 0xffffffn || spacing <= 0n || spacing > 0x7fffffn) throw new Error("Invalid pool key");
  const encoded = [currency0.slice(2).padStart(64,"0"),currency1.slice(2).padStart(64,"0"),fee.toString(16).padStart(64,"0"),spacing.toString(16).padStart(64,"0"),hook.slice(2).padStart(64,"0")].join("");
  const poolId = keccak256(hexToBytes(encoded));
  if (poolId !== l.topics[1].toLowerCase()) throw new Error("Pool ID does not match key");
  const tokenIs1 = normalized === currency1;
  const quoteToken = tokenIs1 ? currency0 : currency1;
  return {poolId,currency0,currency1,quoteToken,tokenIs1,fee:Number(fee),tickSpacing:Number(spacing),hook,nativeQuote:quoteToken === PONS.nativeEth};
}

export interface Launch {
  token: string;
  curve: string;
  deployer: string;
  pairToken: string;
  graduationThreshold: number; // in quote units (ETH for native)
  birthBlock: number;
  poolId: string;
  tokenIs1: boolean; // true when currency0 is the quote (always, for native ETH)
}

let launchCache: Launch | null = null;
let launchCacheKey="";

/** Resolve the curve + pool for RATTERY_CA. Cached per function instance. */
export async function resolveLaunch(): Promise<Launch | null> {
  if (!ENV.ca || ENV.birthBlock === null) return null;
  const cacheKey=JSON.stringify([ENV.rpc,ENV.chainId,ENV.ca,ENV.birthBlock,ENV.curve,ENV.poolId]);
  if (launchCache && launchCacheKey===cacheKey) return launchCache;
  const actual=Number(await rpc<string>('eth_chainId',[]));if(actual!==ENV.chainId)throw new Error(`RPC chain mismatch: expected ${ENV.chainId}, received ${actual}`);

  let curve = ENV.curve;
  let deployer = "";
  let pairToken: string = PONS.nativeEth;
  let threshold = 4.2;

  // TokenLaunched sits in the launch transaction's block. Look a few blocks
  // around RATTERY_BIRTH_BLOCK in case the env value is slightly off.
  const logs = await getLogs(
    { address: PONS.factory, topics: [TOPIC.tokenLaunched, padTopic(ENV.ca)] },
    Math.max(0, ENV.birthBlock - 5),
    ENV.birthBlock + 5
  );
  const ev = logs[0];
  if (ev) {
    curve = curve || topicAddr(ev.topics[2]);
    deployer = topicAddr(ev.topics[3]);
    pairToken = "0x" + word(ev.data, 0).toString(16).padStart(40, "0");
    threshold = toFloat(word(ev.data, 2), 18);
  }
  if (!curve) throw new Error("TokenLaunched not found near RATTERY_BIRTH_BLOCK; set RATTERY_CURVE");

  if (pairToken !== PONS.nativeEth) throw new Error("Unsupported quote token: ETH feed requires native ETH");
  const canonicalPool = ponsPoolId(ENV.ca, pairToken);
  if (ENV.poolId && ENV.poolId !== canonicalPool) throw new Error("Custom pool requires verified currency metadata");
  const poolId = canonicalPool;
  launchCache = {
    token: ENV.ca,
    curve,
    deployer,
    pairToken,
    graduationThreshold: threshold,
    birthBlock: ev ? parseInt(ev.blockNumber, 16) : ENV.birthBlock,
    poolId,
    tokenIs1: pairToken.toLowerCase() < ENV.ca.toLowerCase(),
  };
  launchCacheKey=cacheKey;
  return launchCache;
}

export interface ChainTrade {
  id: string; // txHash:logIndex, unique and stable
  block: number;
  logIndex: number;
  tx: string;
  ts: number; // block timestamp, ms
  side: "buy" | "sell";
  eth: number; // quote leg, in ETH
  tokens: number;
  trader: string;
  venue: "curve" | "pool";
}

/** Decode a CurveBuy / CurveSell log. The trader is an indexed topic. */
export function decodeCurve(l: Log): Omit<ChainTrade, "ts"> | null {
  if(l.topics.length<3||!/^0x[0-9a-fA-F]{256}$/.test(l.data))throw new Error('Malformed curve log');
  const t0 = l.topics[0]?.toLowerCase();
  const base = {
    id: `${l.transactionHash}:${parseInt(l.logIndex, 16)}`,
    block: parseInt(l.blockNumber, 16),
    logIndex: parseInt(l.logIndex, 16),
    tx: l.transactionHash,
    venue: "curve" as const,
  };
  if (t0 === TOPIC.curveBuy) {
    // CurveBuy(buyer indexed, recipient indexed, quoteIn, tokensOut, fee, tax)
    return {
      ...base,
      side: "buy",
      eth: toFloat(word(l.data, 0)),
      tokens: toFloat(word(l.data, 1)),
      trader: topicAddr(l.topics[1]),
    };
  }
  if (t0 === TOPIC.curveSell) {
    // CurveSell(seller indexed, recipient indexed, tokensIn, quoteOut, fee, tax)
    return {
      ...base,
      side: "sell",
      eth: toFloat(word(l.data, 1)),
      tokens: toFloat(word(l.data, 0)),
      trader: topicAddr(l.topics[1]),
    };
  }
  return null;
}

/**
 * Decode a v4 PoolManager Swap. v4 amounts are from the SWAPPER's side:
 * negative = the user paid it into the pool, positive = the user received it
 * (the opposite of v3). The `sender` topic is the router, so the real wallet
 * comes from tx.from and is filled in by the caller.
 * Note: the Pons hook takes its fee outside the core swap, so the ETH leg here
 * can differ from the user's gross amount by about the hook fee.
 */
export function decodeSwap(l: Log, tokenIs1: boolean): Omit<ChainTrade, "ts" | "trader"> | null {
  if(l.topics[0]?.toLowerCase()!==TOPIC.swapV4||l.topics.length<3||!/^0x[0-9a-fA-F]{384}$/.test(l.data))throw new Error('Malformed swap log');
  const a0 = wordSigned(l.data, 0);
  const a1 = wordSigned(l.data, 1);
  const tokenDelta = tokenIs1 ? a1 : a0;
  const quoteDelta = tokenIs1 ? a0 : a1;
  if (tokenDelta === 0n||quoteDelta===0n) return null;
  if((tokenDelta>0n)===(quoteDelta>0n))throw new Error("Invalid swap signs");
  const side = tokenDelta > 0n ? "buy" : "sell";
  return {
    id: `${l.transactionHash}:${parseInt(l.logIndex, 16)}`,
    block: parseInt(l.blockNumber, 16),
    logIndex: parseInt(l.logIndex, 16),
    tx: l.transactionHash,
    venue: "pool",
    side,
    eth: Math.abs(toFloat(quoteDelta)),
    tokens: Math.abs(toFloat(tokenDelta)),
  };
}
