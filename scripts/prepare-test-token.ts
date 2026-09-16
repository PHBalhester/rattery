import {keccakText} from '../api/_lib/keccak.ts';
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
const rpc='https://rpc.testnet.chain.robinhood.com/rpc',factory='0x50230537574FDAE0FF3550Bb76C1D6733D6515A8',wallet=process.env.RATTERY_TEST_WALLET??'';
if(!/^0x[0-9a-fA-F]{40}$/.test(wallet))throw Error('Set RATTERY_TEST_WALLET to an explicit test wallet address');
async function request(method:string,params:unknown[]){const r=await fetch(rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json();}
const word=(n:bigint)=>n.toString(16).padStart(64,'0');
type Value={dynamic:boolean;hex:string};
const fixed=(hex:string):Value=>({dynamic:false,hex:hex.replace(/^0x/,'').padStart(64,'0')});
const str=(s:string):Value=>{const h=Buffer.from(s).toString('hex');return {dynamic:true,hex:word(BigInt(h.length/2))+h.padEnd(Math.ceil(h.length/64)*64,'0')};};
function tuple(values:Value[]):Value{let offset=values.length*32,tail='';const head=values.map(v=>{if(!v.dynamic)return v.hex;const pointer=word(BigInt(offset));tail+=v.hex;offset+=v.hex.length/2;return pointer;}).join('');return {dynamic:true,hex:head+tail};}
const read=async(sig:string,args='')=>{const j=await request('eth_call',[{to:factory,data:keccakText(sig).slice(0,10)+args},'latest']);if(j.error)throw Error(JSON.stringify(j.error));return j.result as string;};
if(Number((await request('eth_chainId',[])).result)!==46630)throw Error('Wrong chain');
const fee=await read('launchFee()'),economics=await read('previewLaunchEconomics(uint256,address)','0'.repeat(128)),allowed=BigInt(await read('canLaunch(address)',wallet.slice(2).padStart(64,'0')))!==0n;
const salt=randomBytes(32).toString('hex');const params=tuple([str('testeRATO'),str('testeRATO'),str(''),str(''),tuple(Array.from({length:5},()=>str(''))),fixed('0'),fixed('0'),fixed('0'),fixed(economics),fixed(salt)]);
const signature='launchToken((string,string,string,string,(string,string,string,string,string),address,uint16,bool,bytes32,bytes32),uint256,address)';
const transaction={from:wallet,to:factory,data:keccakText(signature).slice(0,10)+tuple([params,fixed('0'),fixed('0')]).hex,value:'0x'+BigInt(fee).toString(16)};
const simulation=await request('eth_call',[transaction,'latest']);
const result={network:46630,rpc,wallet,factory,token:{name:'testeRATO',symbol:'testeRATO',creatorTaxBps:0,buybackEnabled:false,pairToken:'0x'+'0'.repeat(40)},launchFeeWei:BigInt(fee).toString(),walletBalanceWei:BigInt((await request('eth_getBalance',[wallet,'latest'])).result).toString(),canLaunch:allowed,simulation,transaction,notice:'UNSIGNED. Not broadcast. Refresh economics and simulate again before signing.'};
mkdirSync('test-results',{recursive:true});writeFileSync('test-results/testeRATO-preflight.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,transaction:'saved unsigned to test-results/testeRATO-preflight.json'},null,2));
