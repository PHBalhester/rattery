import {create} from 'zustand';
import {mainnetPayments,PAYMENT_TOKEN} from './paymentMode';
import {burnCall} from './market/burn';
import {localCareLab} from './localCareGate';

type Listener=(value:unknown)=>void;
export interface Provider {
 request(args:{method:string;params?:unknown[]}):Promise<unknown>;
 on(event:string,listener:Listener):void;
 removeListener(event:string,listener:Listener):void;
}
type Choice={id:string;name:string;provider:Provider};
type WalletState={choices:Choice[];account:string|null;chainId:string|null;name:string;pending:boolean;error:string|null;open:boolean;authenticated:boolean;signing:boolean;authError:string|null};
export const useWallet=create<WalletState>(()=>({choices:[],account:null,chainId:null,name:'',pending:false,error:null,open:false,authenticated:false,signing:false,authError:null}));
let generation=0,cleanup=()=>{},activeProvider:Provider|null=null;
export const stagingSignIn=import.meta.env.VITE_STAGING==='true';
export const walletSignIn=stagingSignIn||mainnetPayments;
export const walletAuthChain=mainnetPayments?4663:46630;
const loginStatement=mainnetPayments?'Sign in to RATTERY. This verifies wallet ownership only; no token transfer, approval or mint is authorized.':'Sign in to RATTERY staging. This verifies wallet ownership only; no token transfer, approval or mint is authorized.';
let authQueue:Promise<unknown>=Promise.resolve();
function authRequest(op:string,data:unknown={}){
 const result=authQueue.catch(()=>{}).then(async()=>{
  const response=await fetch(mainnetPayments?'/api/payment?op=auth/'+op:'/api/session?op='+op,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(response.status===429?'rate':'service');
  return response.json();
 });
 authQueue=result;return result;
}

function provider(value:unknown):value is Provider {
 const p=value as Partial<Provider>|null;
 return !!p&&typeof p.request==='function'&&typeof p.on==='function'&&typeof p.removeListener==='function';
}
function account(value:unknown):string|null {
 if(!Array.isArray(value)||!value.every(a=>typeof a==='string'&&/^0x[0-9a-fA-F]{40}$/.test(a)))throw Error('invalid');
 return value[0]?.toLowerCase()??null;
}
function chain(value:unknown):string {
 if(typeof value!=='string'||!/^0x[0-9a-fA-F]{1,16}$/.test(value)||BigInt(value)===0n)throw Error('invalid');
 return '0x'+BigInt(value).toString(16);
}
export function discoverWallets(){
 const add=(choice:Choice)=>useWallet.setState(s=>s.choices.length>=20||s.choices.some(c=>c.provider===choice.provider||c.id===choice.id)?{}:{choices:[...s.choices,choice]});
 const announce=(event:Event)=>{
  try{
   const detail=(event as CustomEvent).detail,info=detail?.info;
   if(!provider(detail?.provider)||typeof info?.uuid!=='string'||! /^[0-9a-f-]{36}$/i.test(info.uuid)||typeof info.name!=='string')return;
   const name=info.name.replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g,'').trim().slice(0,60);
   if(name)add({id:info.uuid,name,provider:detail.provider});
  }catch{/* Discovery metadata is untrusted. */}
 };
 window.addEventListener('eip6963:announceProvider',announce);
 window.dispatchEvent(new Event('eip6963:requestProvider'));
 const legacy=(window as Window&{ethereum?:unknown}).ethereum;
 if(provider(legacy))add({id:'legacy',name:'Browser wallet',provider:legacy});
 return ()=>window.removeEventListener('eip6963:announceProvider',announce);
}
export function disconnectWallet(){
 generation++;cleanup();cleanup=()=>{};activeProvider=null;
 if(walletSignIn)void authRequest('logout').catch(()=>{});
 useWallet.setState({account:null,chainId:null,name:'',pending:false,error:null,authenticated:false,signing:false,authError:null});
}
export async function connectWallet(id:string){
 if(useWallet.getState().pending||useWallet.getState().signing)return;
 const choice=useWallet.getState().choices.find(c=>c.id===id);if(!choice)return;
 disconnectWallet();const current=++generation;
 useWallet.setState({pending:true,error:null});
 let changed=false,switching=false;
 const targetChain='0x'+walletAuthChain.toString(16);
 const invalidate:Listener=()=>{changed=true;if(current===generation){disconnectWallet();useWallet.setState({error:'changed'});}};
 const lost:Listener=()=>{if(current===generation)disconnectWallet();};
 const networkChanged:Listener=value=>{if(switching&&value===targetChain)return;invalidate(value);};
 const listeners:[string,Listener][]=[['accountsChanged',invalidate],['chainChanged',networkChanged],['disconnect',lost]];
 cleanup=()=>{for(const [event,fn] of listeners){try{choice.provider.removeListener(event,fn);}catch{/* Extension may already be unavailable. */}}};
 const timer=window.setTimeout(()=>{if(current===generation){disconnectWallet();useWallet.setState({error:'timeout'});}},60000);
 try{
  const address=account(await choice.provider.request({method:'eth_requestAccounts'}));
  if(current!==generation||changed)return;
  for(const [event,fn] of listeners)choice.provider.on(event,fn);
  let network=chain(await choice.provider.request({method:'eth_chainId'}));
  if(mainnetPayments&&network!==targetChain){
   switching=true;
   try{await choice.provider.request({method:'wallet_switchEthereumChain',params:[{chainId:targetChain}]});}
   catch(error){
    if((error as {code?:number}).code!==4902||current!==generation)throw error;
    await choice.provider.request({method:'wallet_addEthereumChain',params:[{chainId:targetChain,chainName:'Robinhood Chain',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:['https://rpc.mainnet.chain.robinhood.com'],blockExplorerUrls:['https://robinhoodchain.blockscout.com']}]});
    if(current!==generation)return;
    await choice.provider.request({method:'wallet_switchEthereumChain',params:[{chainId:targetChain}]});
   }
   if(current!==generation)return;
   network=chain(await choice.provider.request({method:'eth_chainId'}));
   switching=false;
   if(network!==targetChain)throw Error('network');
  }
  if(current!==generation||changed)return;
  // Recheck after the asynchronous network request; never retain a stale account.
  const confirmed=account(await choice.provider.request({method:'eth_accounts'}));
  if(current!==generation||changed)return;
  if(!address||confirmed!==address)throw Error('invalid');
  activeProvider=choice.provider;
  useWallet.setState({account:address,chainId:network,name:choice.name,pending:false,error:null});
  clearTimeout(timer);
  if(mainnetPayments)await signInWallet();
 }catch(error){
  if(current!==generation)return;
  disconnectWallet();
  const code=(error as {code?:number})?.code;
  useWallet.setState({error:code===4001?'rejected':code===-32002?'pending':'failed'});
 }finally{clearTimeout(timer);}
}

// Sign-in is explicit and never invokes approval, transfer or transaction RPCs.
export async function signInWallet(){
 const state=useWallet.getState(),p=activeProvider,current=generation;
 if(!walletSignIn||!p||!state.account||state.signing)return;
 if(state.chainId!=='0x'+walletAuthChain.toString(16)){
  const choice=state.choices.find(c=>c.provider===p);
  if(mainnetPayments&&choice){await connectWallet(choice.id);return;}
  useWallet.setState({authError:'network'});return;
 }
 useWallet.setState({signing:true,authError:null,authenticated:false});
 try{
  const c=await authRequest('challenge',{address:state.account});
  if(current!==generation)return;
  // Check the human-readable request before handing it to the extension.
  const lines=typeof c.message==='string'?c.message.split('\n'):[];
  const issued=lines.find((line:string)=>line.startsWith('Issued At: '))?.slice(11);
  const expires=lines.find((line:string)=>line.startsWith('Expiration Time: '))?.slice(17);
  if(lines.length!==11||! /^[0-9a-f-]{36}$/.test(c.id)||lines[2]!==''||lines[4]!==''||lines[0]!==location.host+' wants you to sign in with your Ethereum account:'||lines[1]?.toLowerCase()!==state.account||
     !lines.includes('URI: '+location.origin)||!lines.includes('Version: 1')||!lines.includes('Chain ID: '+walletAuthChain)||
     !lines.includes(loginStatement)||
     !lines.some((line:string)=>/^Nonce: [a-f0-9]{48}$/.test(line))||!issued||!expires||
     !Number.isFinite(Date.parse(issued))||!Number.isFinite(Date.parse(expires))||Date.parse(expires)<=Date.now()||Date.parse(expires)>Date.now()+360000||Math.abs(Date.parse(issued)-Date.now())>60000)throw Error('message');
  if(account(await p.request({method:'eth_accounts'}))!==state.account||chain(await p.request({method:'eth_chainId'}))!==state.chainId)throw Error('changed');
  if(current!==generation)return;
  const hex='0x'+Array.from(new TextEncoder().encode(c.message),v=>v.toString(16).padStart(2,'0')).join('');
  const signature=await p.request({method:'personal_sign',params:[hex,state.account]});
  if(current!==generation)return;
  if(account(await p.request({method:'eth_accounts'}))!==state.account||chain(await p.request({method:'eth_chainId'}))!==state.chainId)throw Error('changed');
  if(current!==generation)return;
  await authRequest('verify',{id:c.id,message:c.message,signature});
  if(current!==generation)return; // Disconnect queued logout after any in-flight verification.
  const session=await authRequest('session');
  if(current!==generation)return;
  if(session.wallet!==state.account||session.chainId!==walletAuthChain||(mainnetPayments?session.paymentsEnabled!==true:session.paymentsEnabled!==false&&!localCareLab))throw Error('service');
  useWallet.setState({authenticated:true});
  window.setTimeout(()=>{if(current===generation){useWallet.setState({authenticated:false});void authRequest('logout').catch(()=>{});}},3600000);
 }catch(error){
  if(current===generation){
   const code=(error as {code?:number})?.code;
   useWallet.setState({authenticated:false,authError:code===4001?'rejected':(error as Error).message});
   void authRequest('logout').catch(()=>{});
  }
 }finally{if(current===generation)useWallet.setState({signing:false});}
}
export function signOutWallet(){disconnectWallet();}

export async function localCareWalletRequest(method:string,params:unknown[]=[]){
 const w=useWallet.getState(),p=activeProvider,current=generation;
 if(!localCareLab||!p||!w.authenticated||!w.account||w.chainId!=='0xb626')throw Error('Local authenticated wallet required');
 if(!['eth_sendTransaction','eth_call'].includes(method))throw Error('Unsupported local wallet method');
 if(!/anvil/i.test(String(await p.request({method:'web3_clientVersion'}))))throw Error('Local Anvil required');
 if(account(await p.request({method:'eth_accounts'}))!==w.account||chain(await p.request({method:'eth_chainId'}))!==w.chainId||current!==generation)throw Error('Wallet changed');
 return p.request({method,params});
}

/** Only a caller-validated, server-reserved direct burn can reach the wallet. */
export async function mainnetBurnRequest(owner:string,amount:bigint,send=false){
 const w=useWallet.getState(),p=activeProvider,current=generation;
 if(!mainnetPayments||!p||!w.authenticated||w.account!==owner||w.chainId!=='0x1237')throw Error('Authenticated mainnet wallet required');
 const call=burnCall(PAYMENT_TOKEN,amount);
 if(account(await p.request({method:'eth_accounts'}))!==owner||chain(await p.request({method:'eth_chainId'}))!=='0x1237'||current!==generation)throw Error('Wallet changed');
 if(!send)return p.request({method:'eth_call',params:[{to:PAYMENT_TOKEN,data:'0x70a08231'+owner.slice(2).padStart(64,'0')},'latest']});
 return p.request({method:'eth_sendTransaction',params:[{from:owner,...call,chainId:'0x1237'}]});
}
