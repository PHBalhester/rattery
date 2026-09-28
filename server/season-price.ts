import {AbiCoder,Interface,keccak256,toBeHex,toQuantity} from 'ethers';
import {PONS,ponsPoolId} from '../api/_lib/pons.js';
import type {ReadRPC} from '../api/_lib/seasonStocks.js';
const abi=new Interface(['function extsload(bytes32) view returns(bytes32)','function latestRoundData() view returns(uint80,int256,uint256,uint256,uint80)','function decimals() view returns(uint8)']);
const TOKEN='0xc322305e79337300b59ff48389f8c9a1d9e0de76',ETH_FEED='0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9';
export function usdBurnUnits(cents:bigint,usdWad:bigint){if(cents<=0n||usdWad<=0n)throw Error('Price unavailable');const denominator=usdWad*100n;return (cents*10n**36n+denominator-1n)/denominator;}
export async function ratteryQuotePrice(read:ReadRPC,clock=Date.now){
 if(Number(await read('eth_chainId',[]))!==4663)throw Error('Wrong chain');
 const head=Number(await read('eth_blockNumber',[])),tag=toQuantity(head-20),block=await read('eth_getBlockByNumber',[tag,false]);
 const now=Math.floor(clock()/1000),time=Number(block.timestamp);if(now-time>60||time>now+10)throw Error('Chain unavailable');
 const poolId=ponsPoolId(TOKEN),slot=keccak256(AbiCoder.defaultAbiCoder().encode(['bytes32','uint256'],[poolId,6]));
 const call=async(to:string,name:string,args:any[]=[])=>abi.decodeFunctionResult(name,await read('eth_call',[{to,data:abi.encodeFunctionData(name,args)},tag]));
 const [state,liquidity,round,dec]=await Promise.all([call(PONS.poolManager,'extsload',[slot]),call(PONS.poolManager,'extsload',[toBeHex(BigInt(slot)+3n,32)]),call(ETH_FEED,'latestRoundData'),call(ETH_FEED,'decimals')]);
 const sqrt=BigInt(state[0])&((1n<<160n)-1n),depth=BigInt(liquidity[0])&((1n<<128n)-1n);
 if(!sqrt||!depth||round[1]<=0n||round[3]<=0n||round[3]>BigInt(time)||BigInt(time)-round[3]>86400n||round[4]<round[0]||Number(dec[0])>18)throw Error('Price unavailable');
 const usdWad=round[1]*10n**18n/10n**dec[0]*(1n<<192n)/(sqrt*sqrt);
 if(usdWad<=0n)throw Error('Price unavailable');
 return {usdWad,at:time*1000,block:head-20,blockHash:block.hash,poolId,ethOracle:ETH_FEED,ethObservedAt:Number(round[3])*1000,source:'Pons canonical native-ETH pool / Chainlink ETH-USD'};
}