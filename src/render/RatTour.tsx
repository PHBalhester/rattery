import {useEffect} from 'react';
import {tr,useLanguage} from '../i18n';
import {getWorld,useStore} from '../store';

/** Living residents in the same order as the residents list. */
function livingIds(){return Object.values(getWorld().rats).filter(r=>r.deadAt===null).sort((a,b)=>a.gen-b.gen||a.bornAt-b.bornAt||a.id.localeCompare(b.id)).map(r=>r.id);}

/** Previous / Next through the residents, like a guided tour. The camera flies between them. */
export default function RatTour(){
 useLanguage(s=>s.language);
 const version=useStore(s=>s.version),focused=useStore(s=>s.focusedId);void version;
 const ids=livingIds(),index=focused?ids.indexOf(focused):-1,rat=focused?getWorld().rats[focused]:undefined;
 const go=(step:number)=>{const list=livingIds();if(!list.length)return;const at=focused?list.indexOf(focused):-1;const next=at<0?(step>0?0:list.length-1):(at+step+list.length)%list.length;useStore.getState().focus(list[next]);};
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{const t=e.target as HTMLElement;if(e.metaKey||e.ctrlKey||e.altKey||t.closest('input,select,textarea,[contenteditable],dialog[open]'))return;
   if(e.key==='ArrowRight'){e.preventDefault();go(1);}else if(e.key==='ArrowLeft'){e.preventDefault();go(-1);}};
  addEventListener('keydown',key);return()=>removeEventListener('keydown',key);
 });
 if(!ids.length)return null;
 return <nav className="rat-tour" aria-label={tr('Browse residents','浏览居民')}>
  <button type="button" onClick={()=>go(-1)} aria-label={tr('Previous rat','上一只大鼠')}><span aria-hidden="true">←</span><span className="rat-tour-label">{tr('Previous','上一只')}</span></button>
  <span className="rat-tour-count" aria-live="polite"><strong key={rat?.id??'none'}>{rat?rat.name:tr('Meet the rats','认识大鼠')}</strong><small>{index>=0?`${index+1} / ${ids.length}`:`${ids.length} ${tr('alive','存活')}`}</small></span>
  <button type="button" onClick={()=>go(1)} aria-label={tr('Next rat','下一只大鼠')}><span className="rat-tour-label">{tr('Next','下一只')}</span><span aria-hidden="true">→</span></button>
 </nav>;
}
