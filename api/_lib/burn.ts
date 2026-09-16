import {burnCall} from '../../src/market/burn.js';
export interface BurnIntent {chainId:number;token:string;wallet:string;amount:bigint;createdAt:number;expiresAt:number;}
export type BurnRPC=(method:string,params:unknown[])=>Promise<any>;
const TRANSFER='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const address=(x:unknown)=>typeof x==='string'&&/^0x[0-9a-fA-F]{40}$/.test(x)?x.toLowerCase():'';
// Verification only. The caller must authenticate/reserve an intent and commit
// its unique receipt key with the action in one persistent database transaction.
export async function verifyBurn(rpc:BurnRPC,hash:string,intent:BurnIntent){
 if(!/^0x[0-9a-fA-F]{64}$/.test(hash)||![4663,46630].includes(intent.chainId)||!address(intent.wallet)||!Number.isSafeInteger(intent.createdAt)||!Number.isSafeInteger(intent.expiresAt)||intent.createdAt<0||intent.expiresAt<intent.createdAt)throw new Error('Invalid burn intent');
 const expected=burnCall(intent.token,intent.amount),wallet=intent.wallet.toLowerCase();hash=hash.toLowerCase();
 if(Number(await rpc('eth_chainId',[]))!==intent.chainId)throw new Error('Wrong chain');
 const tx=await rpc('eth_getTransactionByHash',[hash]),receipt=await rpc('eth_getTransactionReceipt',[hash]);
 if(!tx||!receipt)throw new Error('Burn pending');
 if(tx.hash?.toLowerCase()!==hash||receipt.transactionHash?.toLowerCase()!==hash||address(tx.from)!==wallet||address(tx.to)!==expected.to||address(receipt.from)!==wallet||address(receipt.to)!==expected.to||tx.input?.toLowerCase()!==expected.data||BigInt(tx.value??'1')!==0n)throw new Error('Burn transaction mismatch');
 if(Number(receipt.status)!==1)throw new Error('Burn reverted');
 const block=Number(receipt.blockNumber),head=Number(await rpc('eth_blockNumber',[]));
 if(!Number.isSafeInteger(block)||block<0||!Number.isSafeInteger(head)||head-block<4)throw new Error('Burn not confirmed');
 const canonical=await rpc('eth_getBlockByNumber',[receipt.blockNumber,false]);
 const timestamp=Number(canonical?.timestamp)*1000;
 if(!/^0x[0-9a-fA-F]{64}$/.test(canonical?.hash)||canonical.hash.toLowerCase()!==receipt.blockHash?.toLowerCase()||Number(canonical.number)!==block||!Number.isSafeInteger(timestamp)||timestamp<intent.createdAt||timestamp>intent.expiresAt)throw new Error('Burn anchor/time mismatch');
 const from='0x'+wallet.slice(2).padStart(64,'0'),zero='0x'+'0'.repeat(64);
 const matches=(receipt.logs??[]).filter((l:any)=>address(l.address)===expected.to&&l.topics?.length===3&&l.topics[0]?.toLowerCase()===TRANSFER&&l.topics[1]?.toLowerCase()===from&&l.topics[2]?.toLowerCase()===zero&&/^0x[0-9a-fA-F]{64}$/.test(l.data)&&BigInt(l.data)===intent.amount&&!l.removed);
 if(matches.length!==1||!Number.isSafeInteger(Number(matches[0].logIndex))||Number(matches[0]?.logIndex)<0)throw new Error('Expected one exact burn event');
 return {key:`${intent.chainId}:${expected.to}:${hash}:${Number(matches[0].logIndex)}`,hash,block,blockHash:canonical.hash,timestamp,wallet,token:expected.to,amount:intent.amount.toString()};
}
