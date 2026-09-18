import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {burnCall,tokenUnits} from '../src/market/burn';
import {verifyBurn} from '../api/_lib/burn';
const token='0x'+'a'.repeat(40),wallet='0x'+'b'.repeat(40),hash='0x'+'c'.repeat(64),blockHash='0x'+'d'.repeat(64),amount=tokenUnits(500000,18);
const intent={chainId:4663,token,wallet,amount,createdAt:100000,expiresAt:120000};
const tx={hash,from:wallet,to:token,input:burnCall(token,amount).data,value:'0x0'};
const receipt={transactionHash:hash,from:wallet,to:token,status:'0x1',blockNumber:'0xa',blockHash,logs:[{address:token,topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef','0x'+wallet.slice(2).padStart(64,'0'),'0x'+'0'.repeat(64)],data:'0x'+amount.toString(16).padStart(64,'0'),logIndex:'0x2'}]};
function fixture(){return {chain:'0x1237',head:'0x1e',tx:structuredClone(tx),receipt:structuredClone(receipt),block:{hash:blockHash,number:'0xa',timestamp:'0x6e'}};}
function rpc(f:any){return async(method:string)=>{switch(method){case 'eth_chainId':return f.chain;case 'eth_blockNumber':return f.head;case 'eth_getTransactionByHash':return f.tx;case 'eth_getTransactionReceipt':return f.receipt;case 'eth_getBlockByNumber':return f.block;default:throw new Error(method);}};}
const verified=await verifyBurn(rpc(fixture()),hash,intent);assert.equal(verified.amount,amount.toString());
const mutations:Record<string,(f:any)=>void>={chain:f=>f.chain='0x1',pending:f=>f.receipt=null,reverted:f=>f.receipt.status='0x0',sender:f=>f.tx.from=token,token:f=>f.tx.to=wallet,call:f=>f.tx.input='0xa9059cbb',value:f=>f.tx.value='0x1',confirmations:f=>f.head='0x1d',reorg:f=>f.block.hash=hash,expired:f=>f.block.timestamp='0x100',amount:f=>f.receipt.logs[0].data='0x'+'0'.repeat(64),destination:f=>f.receipt.logs[0].topics[2]='0x'+'e'.repeat(64),emitter:f=>f.receipt.logs[0].address=wallet,duplicate:f=>f.receipt.logs.push(f.receipt.logs[0]),removed:f=>f.receipt.logs[0].removed=true};
for(const [name,mutate] of Object.entries(mutations)){const f=fixture();mutate(f);await assert.rejects(()=>verifyBurn(rpc(f),hash,intent),undefined,name);}
assert.equal(tokenUnits(10000,6),10000000000n);assert.throws(()=>tokenUnits(.1,18));assert.throws(()=>burnCall(token,0n));
// Same receipt always has the same unique key, for transactional DB deduplication.
assert.equal((await verifyBurn(rpc(fixture()),hash,intent)).key,verified.key);
writeFileSync('test-results/burn-test.json',JSON.stringify({passed:true,scope:'Controlled RPC fixtures; no real burn sent',rejected:Object.keys(mutations),verified},null,2));console.log('PASS: native burn calldata, exact units, 15 invalid receipts and stable deduplication key');
