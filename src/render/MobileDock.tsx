import {useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {tr,useLanguage} from '../i18n';
import {useCA,useStore} from '../store';
import {SITE,ponsUrl} from '../config';
import TokenBurn from './TokenBurn';
import {SeasonSheetBody} from './SeasonRail';

/*
 * Phone navigation (visible at 780 px and below, hidden by CSS on larger screens).
 * Colony and Rats open the existing panels (tap again to close them and watch the colony);
 * Season, Trade and More open bottom sheets. Nothing here changes wallet, payment or simulation logic.
 */
type Sheet='season'|'trade'|'more'|null;
type Tab='colony'|'rats'|'season'|'trade'|'more';
const TABS:Tab[]=['colony','rats','season','trade','more'];

const Icon:Record<Tab,ReactNode>={
 colony:<svg viewBox="0 0 24 24"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.6"/></svg>,
 rats:<svg viewBox="0 0 24 24"><path d="M5 16c0-4 3-7 7-7 2.5 0 4 1 5 2.5l2.5.5-1.5 2c0 2-2 3.5-4 3.5H8"/><circle cx="15.5" cy="8" r="1.6"/><path d="M5 16c-1.5 0-2.5 1-2 2.5.4 1.1 2 1.5 3.5.5"/></svg>,
 season:<svg viewBox="0 0 24 24"><path d="M12 3l2.2 5.4 5.8.5-4.4 3.8 1.3 5.7L12 15.4l-4.9 3 1.3-5.7L4 8.9l5.8-.5z"/></svg>,
 trade:<svg viewBox="0 0 24 24"><path d="M4 16l5-5 3 3 7-7"/><path d="M14 7h5v5"/></svg>,
 more:<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>,
};

export default function MobileDock(){
 useLanguage(s=>s.language);
 const cinema=useStore(s=>s.cinema),panel=useStore(s=>s.panel),openPanel=useStore(s=>s.openPanel);
 const [sheet,setSheet]=useState<Sheet>(null);
 const ca=useCA(),chain=useStore(s=>s.chain),testnet=chain?.chainId===46630;
 const [copied,setCopied]=useState(false);
 const sheetRef=useRef<HTMLDivElement>(null);
 const active:Tab|null=sheet??(cinema?null:panel==='residents'?'rats':'colony');
 const index=active?TABS.indexOf(active):-1;
 const closePanels=()=>{if(!useStore.getState().cinema)useStore.getState().toggleCinema();};
 const press=(tab:Tab)=>{
  if(tab==='colony'||tab==='rats'){
   setSheet(null);
   if(active===tab)closePanels();else openPanel(tab==='rats'?'residents':'colony');
   return;
  }
  setSheet(s=>s===tab?null:tab);
 };
 useEffect(()=>{if(!sheet)return;sheetRef.current?.focus({preventScroll:true});
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setSheet(null);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[sheet]);
 // Opening a panel from elsewhere (a rat in the scene, the tutorial) closes any open sheet.
 useEffect(()=>{if(!cinema)setSheet(null);},[cinema,panel]);
 const copy=async()=>{if(!ca)return;try{await navigator.clipboard.writeText(ca);setCopied(true);setTimeout(()=>setCopied(false),1400);}catch{/* The address stays visible to copy by hand. */}};
 const aria:Record<Tab,string>={colony:tr('Colony panel','群落面板'),rats:tr('Rats panel','大鼠面板'),season:tr('Season I','第一赛季'),trade:tr('Trade RATTERY','交易RATTERY'),more:tr('More options','更多选项')};
 const label:Record<Tab,string>={colony:tr('Colony','群落'),rats:tr('Rats','大鼠'),season:tr('Season','赛季'),trade:tr('Trade','交易'),more:tr('More','更多')};
 return <>
  {sheet&&<div className="dock-backdrop" onClick={()=>setSheet(null)} aria-hidden="true"/>}
  {sheet&&<div ref={sheetRef} tabIndex={-1} className={`dock-sheet is-${sheet}`} role="dialog" aria-modal="false" aria-label={label[sheet]}>
   <span className="dock-grabber" aria-hidden="true"/>
   <button type="button" className="dock-close" onClick={()=>setSheet(null)} aria-label={tr('Close','关闭')}>×</button>
   {sheet==='season'&&<SeasonSheetBody onAction={()=>setSheet(null)}/>}
   {sheet==='trade'&&<div className="dock-trade">
    <span className="dock-kicker">RATTERY · Robinhood Chain</span>
    <h2>{tr('Trade RATTERY','交易RATTERY')}</h2>
    <p>{tr('Buys feed the colony and sells stress it. Trading happens on Pons, outside this site.','买入喂养群落，卖出带来压力。交易在Pons上进行，不在本站内。')}</p>
    <a className="dock-cta" href={testnet?chain!.links.explorer:ponsUrl(ca)} target="_blank" rel="noopener noreferrer">{testnet?tr('Open testnet explorer','打开测试网浏览器'):tr('Trade on Pons','在Pons交易')} <span aria-hidden="true">↗</span></a>
    {ca?<button type="button" className="dock-ca" onClick={copy}><small>{tr('Contract address','合约地址')}</small><code>{ca}</code><b>{copied?tr('Copied ✓','已复制 ✓'):tr('Copy','复制')}</b></button>:<p className="dock-note">{tr('Token pending','代币待发布')}</p>}
    <div className="dock-burn"><TokenBurn/></div>
    <p className="dock-note">{tr('Always check the contract address before trading. Not financial advice.','交易前请务必核对合约地址。并非投资建议。')}</p>
   </div>}
   {sheet==='more'&&<div className="dock-more">
    <span className="dock-kicker">RATTERY</span>
    <button type="button" className="dock-row" onClick={()=>{setSheet(null);window.dispatchEvent(new Event('rattery:welcome'));}}><span aria-hidden="true">?</span>{tr('How it works','如何运作')}</button>
    <a className="dock-row" href={SITE.x} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">𝕏</span>X / Twitter <i aria-hidden="true">↗</i></a>
    <a className="dock-row" href={SITE.github} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">{'</>'}</span>GitHub <i aria-hidden="true">↗</i></a>
    <p className="dock-note">{tr('RATTERY · A digital colony experiment. Simulated behavior, not scientific measurements.','RATTERY · 数字群落实验。行为为模拟，并非科学测量结果。')}</p>
   </div>}
  </div>}
  <nav className="mobile-dock" aria-label={tr('Main','主导航')} style={{'--tab':index} as CSSProperties} data-active={active??'none'}>
   <span className="dock-indicator" aria-hidden="true"/>
   {TABS.map(tab=><button key={tab} type="button" className={`dock-tab is-${tab}`} aria-label={aria[tab]} aria-pressed={active===tab} aria-expanded={tab==='season'||tab==='trade'||tab==='more'?sheet===tab:undefined} onClick={()=>press(tab)}>
    <span className="dock-icon" aria-hidden="true">{Icon[tab]}{tab==='season'&&<i className="dock-dot"/>}</span><span className="dock-label">{label[tab]}</span>
   </button>)}
  </nav>
 </>;
}
