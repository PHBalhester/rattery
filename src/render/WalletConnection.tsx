import {useEffect,useRef} from 'react';
import {tr,useLanguage} from '../i18n';
import {useStore} from '../store';
import {useWallet,discoverWallets,connectWallet,disconnectWallet} from '../wallet';

export default function WalletConnection(){
 useLanguage(s=>s.language);
 const w=useWallet(),dialog=useRef<HTMLDialogElement>(null);
 const expected=useStore(s=>s.chain?.chainId);
 useEffect(discoverWallets,[]);
 useEffect(()=>{if(w.open)dialog.current?.showModal();else dialog.current?.close();},[w.open]);
 const errors:Record<string,[string,string]>={
 rejected:['Connection declined. No signature or transaction was requested.','连接已拒绝。未请求签名或交易。'],
 changed:['Wallet account or network changed. Reconnect to continue.','钱包账户或网络已更改，请重新连接。'],
 timeout:['Wallet did not respond. Check its pending requests before retrying.','钱包未响应，重试前请检查待处理请求。'],
 pending:['A request is already open in your wallet. Check the wallet extension.','钱包已有待处理请求，请查看钱包扩展。'],
 failed:['Could not verify the connection. Unlock your wallet and try again.','无法验证连接，请解锁钱包后重试。']
 };
 const close=()=>useWallet.setState({open:false});
 return <><button className="chip wallet-trigger" onClick={()=>useWallet.setState({open:true})} aria-haspopup="dialog">{w.account?w.account.slice(0,6)+'…'+w.account.slice(-4):tr('Wallet','钱包')}</button>
 <dialog ref={dialog} className="wallet-dialog" aria-labelledby="wallet-title" onCancel={close} onClose={close}>
 <header><span>RATTERY</span><button className="chip" onClick={close} aria-label={tr('Close wallet panel','关闭钱包面板')}>×</button></header>
 <h2 id="wallet-title">{tr(w.account?'Your wallet':'Connect your wallet',w.account?'您的钱包':'连接您的钱包')}</h2>
 <p>{tr('A living 3D rat colony shaped by community activity. Observe freely, discover each rat’s story and prepare for individual care.','由社区活动塑造的3D大鼠群落。自由观察，探索每只大鼠的故事，为个体照护做好准备。')}</p>
 <div className="wallet-scope">{tr('Connection shares your public wallet address. It requests no signature, token approval or transaction.','连接仅共享您的公开钱包地址，不请求签名、代币授权或交易。')}</div>
 {w.account?<><dl><dt>{tr('Wallet','钱包')}</dt><dd>{w.name}</dd><dt>{tr('Address','地址')}</dt><dd>{w.account}</dd><dt>{tr('Network ID','网络编号')}</dt><dd>{w.chainId?BigInt(w.chainId).toString():''}</dd></dl>
 {expected&&w.chainId&&BigInt(w.chainId)!==BigInt(expected)&&<p className="wallet-error">{tr('This wallet is on a different network from the colony. Change networks in your wallet before reconnecting.','钱包网络与群落网络不同。请在钱包中切换网络后重新连接。')}</p>}
 <button className="chip" onClick={disconnectWallet}>{tr('Disconnect from RATTERY','断开与RATTERY的连接')}</button>
 <p className="wallet-fine">{tr('This clears the app connection. Revoke site permissions in your wallet if desired.','这会清除应用连接。如需撤销网站权限，请在钱包中操作。')}</p></>:
 <div className="wallet-choices">{w.choices.map(c=><button className="chip" key={c.id} disabled={w.pending} onClick={()=>void connectWallet(c.id)}>{c.name}</button>)}
 {!w.choices.length&&<p>{tr('No compatible browser wallet detected. Open RATTERY in a wallet-enabled browser. Mobile QR connection is not available yet.','未检测到兼容的钱包。请在支持钱包的浏览器中打开RATTERY，暂不支持手机扫码连接。')}</p>}</div>}
 <p role="status" className={w.error?'wallet-error':''}>{w.pending?tr('Confirm the connection in your wallet…','请在钱包中确认连接…'):w.error?tr(...errors[w.error]):''}</p>
 <footer>{tr('Connection is not a verified sign-in. Minting and paid care remain unavailable until the RATTERY token and secure payment service are configured. Demo accounts use fictional tokens.','连接并非经过验证的登录。RATTERY代币和安全支付服务配置完成前，铸造与付费照护仍不可用。演示账户使用虚拟代币。')}</footer>
 </dialog></>;
}
