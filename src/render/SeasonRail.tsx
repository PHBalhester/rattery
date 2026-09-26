import {tr,useLanguage} from '../i18n';

function Flourish({flip=false}:{flip?:boolean}){
 return <svg className={`season-flourish${flip?' is-flipped':''}`} viewBox="0 0 64 16" aria-hidden="true"><path d="M2 8h38" /><path d="M40 8c6 0 8-6 13-6 4 0 6 3 6 6s-2 6-6 6c-3 0-5-2-5-4" /><path d="M44 8l4-4 4 4-4 4z" className="gem" /><circle cx="6" cy="8" r="1.6" className="gem" /></svg>;
}

/** Announcement only until the explicit Monday release. No hidden tutorial is shipped. */
export default function SeasonRail(){
 useLanguage(s=>s.language);
 return <aside className="season-rail floating-panel" aria-labelledby="season-title">
  <span className="season-corner tl" aria-hidden="true"/><span className="season-corner tr" aria-hidden="true"/><span className="season-corner bl" aria-hidden="true"/><span className="season-corner br" aria-hidden="true"/>
  <span className="season-kicker">{tr('RATTERY · Colony games','RATTERY · 群落赛事')}</span>
  <div className="season-title-row"><Flourish/><h2 id="season-title" lang="en">Season&nbsp;<span>I</span></h2><Flourish flip/></div>
  <p className="season-sub">{tr('A new chapter for the colony','群落的新篇章')}</p>
  <span className="season-status"><i aria-hidden="true"/>{tr('Coming soon','即将推出')}</span>
  <div className="season-actions">
   <button type="button" className="season-button" disabled><span aria-hidden="true">▶</span>{tr('Tutorial','教程')}<small>{tr('Coming soon','即将推出')}</small></button>
   <button type="button" className="season-button" disabled><span aria-hidden="true">§</span>{tr('Whitepaper','白皮书')}<small>{tr('Coming soon','即将推出')}</small></button>
  </div>
 </aside>;
}

/** Mobile has the same locked release state as desktop. */
export function SeasonNavButton(){
 useLanguage(s=>s.language);
 return <button type="button" className="season-nav-button" disabled>✦ Season I · {tr('Coming soon','即将推出')}</button>;
}