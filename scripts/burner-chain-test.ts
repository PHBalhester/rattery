import assert from 'node:assert/strict';
import {Interface} from 'ethers';
import {SeasonBurnerChain,BURNER_ROUTER} from '../server/burner-chain';
import {seasonActionInterface} from '../src/market/seasonBurn';
const abi=new Interface(['event Transfer(address indexed from,address indexed to,uint256 value)','function members(address) view returns(uint256 id,uint8 nest)']);
const wallet='0x'+'a'.repeat(40),hash='0x'+'1'.repeat(64),token='0xc322305e79337300b59ff48389f8c9a1d9e0de76';
const transfer=abi.encodeEventLog(abi.getEvent('Transfer')!,[BURNER_ROUTER,'0x'+'0'.repeat(40),100n]);
const action=seasonActionInterface.encodeEventLog(seasonActionInterface.getEvent('ActionExecuted')!,[hash,wallet,1n,0n,0,1,100n,1000n,1n,0n,false]);
let nest=1,reads=0,bad=false;
const read=async(method:string,params:unknown[])=>{
 if(method==='eth_getTransactionReceipt'){reads++;return {status:'0x1',transactionHash:hash,blockNumber:'0xa',logs:[{address:token,logIndex:'0x2',...transfer},...(!bad?[{address:BURNER_ROUTER,logIndex:'0x3',...action}]:[])]};}
 if(method==='eth_blockNumber')return '0x20';
 if(method==='eth_call'){assert.equal(params[1],'0x20');return abi.encodeFunctionResult('members',nest?[1n,nest]:[0n,0]);}
 throw Error('Unexpected method');
};
const chain=new SeasonBurnerChain(read),burn={block:10,logIndex:2,hash,from:BURNER_ROUTER,units:'100'};
assert.equal(await chain.owner(burn),wallet);assert.equal(await chain.owner(burn),wallet);assert.equal(reads,1);
assert.equal(await chain.owner({...burn,from:wallet}),wallet);assert.equal(reads,1);
assert.deepEqual(await chain.nests([wallet]),['NVDA']);nest=3;assert.deepEqual(await chain.nests([wallet]),['AMZN'],'Refresh changed membership');nest=0;assert.deepEqual(await chain.nests([wallet]),[null]);
await assert.rejects(()=>new SeasonBurnerChain(read).owner({...burn,units:'101'}));
bad=true;await assert.rejects(()=>new SeasonBurnerChain(read).owner(burn),'Cannot attribute missing action to router or tx sender');
console.log('PASS router attribution, cache, amount checks, absent events and current nest switches');
