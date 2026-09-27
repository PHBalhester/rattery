import {lazy,Suspense,useEffect} from 'react';
import {create} from 'zustand';
import {tr,useLanguage} from '../i18n';
import {SEASON_TUTORIAL_LIVE,SEASON_WINDOWS_LIVE} from '../copy/season';

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

function Flourish({flip=false}:{flip?:boolean}){
 return <svg className={`season-flourish${flip?' is-flipped':''}`} viewBox="0 0 64 16" aria-hidden="true"><path d="M2 8h38" /><path d="M40 8c6 0 8-6 13-6 4 0 6 3 6 6s-2 6-6 6c-3 0-5-2-5-4" /><path d="M44 8l4-4 4 4-4 4z" className="gem" /><circle cx="6" cy="8" r="1.6" className="gem" /></svg>;
}

/** Announcement only until the explicit release. The tutorial is compiled in only when TUTORIAL_ON. */
export default function SeasonRail(){
 useLanguage(s=>s.language);
 return <div className={`season-column${WINDOWS_ON?' has-windows':''}`}><aside className="season-rail floating-panel" aria-labelledby="season-title">
  <span className="season-corner tl" aria-hidden="true"/><span className="season-corner tr" aria-hidden="true"/><span className="season-corner bl" aria-hidden="true"/><span className="season-corner br" aria-hidden="true"/>
  <span className="season-kicker">{tr('RATTERY · Colony games','RATTERY · 群落赛事')}</span>
  <div className="season-title-row"><Flourish/><h2 id="season-title" lang="en">Season&nbsp;<span>I</span></h2><Flourish flip/></div>
  <p className="season-sub">{tr('A new chapter for the colony','群落的新篇章')}</p>
  <span className="season-status"><i aria-hidden="true"/>{tr('Coming soon','即将推出')}</span>
  <div className="season-actions">
   {TUTORIAL_ON?<button type="button" className="season-button is-primary" onClick={()=>openTutorial()}><span aria-hidden="true">▶</span>{tr('Tutorial','教程')}</button>:<button type="button" className="season-button" disabled><span aria-hidden="true">▶</span>{tr('Tutorial','教程')}<small>{tr('Coming soon','即将推出')}</small></button>}
   <button type="button" className="season-button" disabled><span aria-hidden="true">§</span>{tr('Whitepaper','白皮书')}<small>{tr('Coming soon','即将推出')}</small></button>
  </div>
  {TUTORIAL_ON&&<TutorialHost/>}
 </aside>{WINDOWS_ON&&<WindowsHost/>}</div>;
}

/** Mobile has the same locked release state as desktop. */
export function SeasonNavButton(){
 useLanguage(s=>s.language);
 return TUTORIAL_ON?<button type="button" className="season-nav-button" onClick={()=>openTutorial()}>✦ Season I · {tr('Tutorial','教程')}</button>:<button type="button" className="season-nav-button" disabled>✦ Season I · {tr('Coming soon','即将推出')}</button>;
}