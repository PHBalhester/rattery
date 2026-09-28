import SeasonLiveSummary from './SeasonLiveSummary';
import {useSeason,refreshSeason} from '../seasonState';
import {useWallet} from '../wallet';
import {lazy,Suspense,useEffect} from 'react';
import {create} from 'zustand';
import {tr,useLanguage} from '../i18n';
import {SEASON_TUTORIAL_LIVE,SEASON_WINDOWS_LIVE,SEASON_LEADERBOARD_LIVE,WHITEPAPER_URL} from '../copy/season';

// Compile-time gate: when false the tutorial chunk is not emitted at all.
const TUTORIAL_BUILD=import.meta.env.DEV||SEASON_TUTORIAL_LIVE||import.meta.env.VITE_SEASON_TUTORIAL==='true';
// Before release, review builds unlock it only with ?season-tutorial; the default page stays locked.
const TUTORIAL_ON=TUTORIAL_BUILD&&(SEASON_TUTORIAL_LIVE||new URLSearchParams(location.search).has('season-tutorial'));
const SeasonTutorial=TUTORIAL_BUILD?lazy(()=>import('./SeasonTutorial')):null;
const useTutorial=create<{open:boolean;start?:string}>(()=>({open:false}));
const openTutorial=(start?:string)=>useTutorial.setState({open:true,start});

// Stock and Weekly Prize windows follow the same pattern: compiled in for review builds or at release,
// shown before release only with ?season-tutorial or ?season-preview.
const WINDOWS_BUILD=import.meta.env.DEV||SEASON_WINDOWS_LIVE||import.meta.env.VITE_SEASON_TUTORIAL==='true';
const WINDOWS_ON=WINDOWS_BUILD&&(SEASON_WINDOWS_LIVE||['season-tutorial','season-preview'].some(k=>new URLSearchParams(location.search).has(k)));
const SeasonWindows=WINDOWS_BUILD?lazy(()=>import('./SeasonWindows')):null;

// Top-burner leaderboard: hidden until toggled. Live once /api/burners is deployed (SEASON_LEADERBOARD_LIVE);
// before that, review builds show it with ?burners, ?season-tutorial or ?season-preview (DEMO rows if the API is absent).
const BOARD_BUILD=import.meta.env.DEV||SEASON_LEADERBOARD_LIVE||import.meta.env.VITE_SEASON_TUTORIAL==='true';
const BOARD_ON=BOARD_BUILD&&(SEASON_LEADERBOARD_LIVE||['burners','season-tutorial','season-preview'].some(k=>new URLSearchParams(location.search).has(k)));
const BurnLeaderboard=BOARD_BUILD?lazy(()=>import('./BurnLeaderboard')):null;
const SeasonAction=lazy(()=>import('./SeasonAction'));
function ActionsHost(){const account=useWallet(s=>s.account);useEffect(()=>{void refreshSeason();const t=setInterval(()=>void refreshSeason(),15000);return()=>clearInterval(t);},[account]);return <Suspense fallback={null}><SeasonAction/></Suspense>;} 
const StockPopup=lazy(()=>import('./StockPopup'));
const useStocks=create<{open:boolean}>(()=>({open:false}));
const closeStocks=()=>useStocks.setState({open:false});
function StocksHost(){const open=useStocks(s=>s.open);return open?<Suspense fallback={null}><StockPopup onClose={closeStocks}/></Suspense>:null;}
const useBoard=create<{open:boolean}>(()=>({open:false}));
const toggleBoard=()=>useBoard.setState(s=>({open:!s.open}));

function BoardToggle({onAction}:{onAction?:()=>void}){
 const open=useBoard(s=>s.open);
 return <button type="button" className="season-board-toggle" aria-expanded={open} aria-controls="burn-board" onClick={()=>{onAction?.();toggleBoard();}}>
  <span aria-hidden="true" className="burn-flame">🔥</span>{tr('Top burners','销毁排行')}<span aria-hidden="true" className="burn-chevron">›</span></button>;
}

const GAMEPLAY_ACTIONS=[
 {id:'join',label:['Join a nest','加入巢穴'],hint:['Choose your team','选择你的队伍'],path:'M3 11l9-8 9 8M5 10v11h14V10M9 21v-7h6v7'},
 {id:'feed',label:['Feed','喂养'],hint:['Grow your nest’s score','增加巢穴积分'],path:'M4 13h16a8 8 0 0 1-16 0ZM8 9V5m4 4V3m4 6V5'},
 {id:'shield',label:['Shield','护盾'],hint:['Block a rival attack','抵挡对手攻击'],path:'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6'},
 {id:'attack',label:['Attack','攻击'],hint:['Send a snake to a rival','向对手放出蛇'],path:'M4 18c3 0 3-4 6-4s3 4 6 4 3-6 0-8-6-1-6-4 3-3 6-2M17 4h3m-1-1 1 1-1 1'},
] as const;

/** One action group for the desktop banner and the mobile Season sheet. Gameplay is not live yet. */
function SeasonActivities({onAction}:{onAction?:()=>void}){
 const {snapshot,available}=useSeason();const live=available&&snapshot?.phase==='open';
 return <div className="season-activity-area">
  <section className="season-gameplay" aria-label={tr('Season I nest actions','第一赛季巢穴操作')}>
   <div className="season-gameplay-heading"><h3>{tr('Nest actions','巢穴操作')}</h3><span>{live?tr('Open','进行中'):snapshot?.phase==='scheduled'?tr('Opens at 13:00 São Paulo','圣保罗13:00开启'):tr('Not open','尚未开启')}</span></div>
   <div className="season-gameplay-grid">{GAMEPLAY_ACTIONS.map((a,index)=><button key={a.id} type="button" className={'season-gameplay-action is-'+a.id} disabled={!live} onClick={()=>{onAction?.();useSeason.setState({action:index});}} title={tr('Available when Season I opens','第一赛季开启后可用')}>
    <span className="season-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={a.path}/></svg></span>
    <strong>{tr(a.label[0],a.label[1])}</strong><span className="season-action-hint">{tr(a.hint[0],a.hint[1])}</span>
   </button>)}</div>
  </section>
  <SeasonLiveSummary/>
  <div className="season-resources"><button type="button" className="season-stocks-toggle" aria-haspopup="dialog" onClick={()=>{onAction?.();useStocks.setState({open:true});}}><span aria-hidden="true">↗</span>{tr('Stock watch','股票行情')}<span>NVDA · AAPL · AMZN</span></button>
   <div className="season-actions">
    <button type="button" className={'season-button'+(TUTORIAL_ON?' is-primary':'')} disabled={!TUTORIAL_ON} onClick={()=>{onAction?.();openTutorial();}}><span aria-hidden="true">▶</span>{tr('Tutorial','教程')}</button>
    {WHITEPAPER_URL?<a className="season-button" href={WHITEPAPER_URL} target="_blank" rel="noopener" onClick={()=>onAction?.()}><span aria-hidden="true">§</span>{tr('Whitepaper','白皮书')}<span className="season-button-ext" aria-hidden="true">↗</span></a>:<button type="button" className="season-button" disabled><span aria-hidden="true">§</span>{tr('Whitepaper','白皮书')}<small>{tr('Coming soon','即将推出')}</small></button>}
   </div>
   {BOARD_ON&&<BoardToggle onAction={onAction}/>}
  </div>
 </div>;
}
function BoardHost(){
 const open=useBoard(s=>s.open);
 // The resident tour sits at the top centre; step it aside while the leaderboard is open.
 useEffect(()=>{document.documentElement.classList.toggle('burn-open',open);return()=>document.documentElement.classList.remove('burn-open');},[open]);
 if(!BurnLeaderboard||!open)return null;
 return <div id="burn-board" className="burn-board-host"><Suspense fallback={null}><BurnLeaderboard allowDemo={!SEASON_LEADERBOARD_LIVE} onClose={()=>{useBoard.setState({open:false});Array.from(document.querySelectorAll<HTMLElement>('.season-board-toggle,.burn-nav-toggle,.dock-tab.is-season')).find(b=>b.offsetParent!==null)?.focus();}}/></Suspense></div>;
}

function TutorialHost(){
 const {open,start}=useTutorial();
 useEffect(()=>{if(new URLSearchParams(location.search).has('season-tutorial'))openTutorial();
  const help=(e:Event)=>openTutorial((e as CustomEvent<string>).detail);
  window.addEventListener('rattery:season-tutorial',help);return()=>window.removeEventListener('rattery:season-tutorial',help);},[]);
 if(!SeasonTutorial||!open)return null;
 return <Suspense fallback={null}><SeasonTutorial start={start} onClose={()=>useTutorial.setState({open:false,start:undefined})}/></Suspense>;
}

function WindowsHost(){
 // Demo numbers only exist in review builds; a release build without a feed shows "pending".
 useEffect(()=>{if(!SEASON_WINDOWS_LIVE)void import('./seasonFeed').then(f=>f.startDemoFeed());},[]);
 return SeasonWindows?<Suspense fallback={null}><SeasonWindows/></Suspense>:null;
}

function SeasonStatus(){const {snapshot,available}=useSeason();return <>{available&&snapshot?.phase==='open'?tr('Season open','赛季进行中'):snapshot?.phase==='scheduled'?tr('Today · 13:00 São Paulo','今天 · 圣保罗13:00'):snapshot?.phase==='closed'?tr('Season closed','赛季已结束'):tr('Preparing Season I','正在准备第一赛季')}</>;}
function Flourish({flip=false}:{flip?:boolean}){
 return <svg className={`season-flourish${flip?' is-flipped':''}`} viewBox="0 0 64 16" aria-hidden="true"><path d="M2 8h38" /><path d="M40 8c6 0 8-6 13-6 4 0 6 3 6 6s-2 6-6 6c-3 0-5-2-5-4" /><path d="M44 8l4-4 4 4-4 4z" className="gem" /><circle cx="6" cy="8" r="1.6" className="gem" /></svg>;
}

/** Announcement only until the explicit release. The tutorial is compiled in only when TUTORIAL_ON. */
export default function SeasonRail(){
 useLanguage(s=>s.language);
 return <><div className={`season-column${WINDOWS_ON?' has-windows':''}`}><aside className="season-rail floating-panel" aria-labelledby="season-title">
  <span className="season-corner tl" aria-hidden="true"/><span className="season-corner tr" aria-hidden="true"/><span className="season-corner bl" aria-hidden="true"/><span className="season-corner br" aria-hidden="true"/>
  <header className="season-banner">
  <span className="season-kicker">{tr('RATTERY · Colony games','RATTERY · 群落赛事')}</span>
  <div className="season-title-row"><Flourish/><h2 id="season-title" lang="en">Season&nbsp;<span>I</span></h2><Flourish flip/></div>
  <p className="season-sub">{tr('A new chapter for the colony','群落的新篇章')}</p>
  <span className="season-status"><i aria-hidden="true"/><SeasonStatus/></span>
  </header>
  <SeasonActivities/>
  {TUTORIAL_ON&&<TutorialHost/>}
 </aside>{WINDOWS_ON&&<WindowsHost/>}</div>{BOARD_ON&&<BoardHost/>}<StocksHost/><ActionsHost/></>;
}

/** Season content for the mobile dock's Season sheet: same gates and actions as the desktop card. */
export function SeasonSheetBody({onAction}:{onAction:()=>void}){
 useLanguage(s=>s.language);
 return <div className="dock-season">
  <header className="season-banner">
  <span className="season-kicker">{tr('RATTERY · Colony games','RATTERY · 群落赛事')}</span>
  <div className="season-title-row"><Flourish/><h2 lang="en">Season&nbsp;<span>I</span></h2><Flourish flip/></div>
  <span className="season-status"><i aria-hidden="true"/><SeasonStatus/></span>
  </header>
  <SeasonActivities onAction={onAction}/>
 </div>;
}

