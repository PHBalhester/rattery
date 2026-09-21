import {useState} from 'react';
import {tr} from '../i18n';
import {coatFor} from './ratIdentity';
import {getWorld,useStore} from '../store';
import type {MemorialRecord} from '../types';

export default function LineageTree(){
 const version=useStore(s=>s.version),focusedId=useStore(s=>s.focusedId),focus=useStore(s=>s.focus);void version;
 const [query,setQuery]=useState(''),[familyId,setFamilyId]=useState<string|null>(null);
 const world=getWorld();
 const records:Record<string,MemorialRecord>={...world.memorial,...world.rats};
 const sorted=Object.values(records).sort((a,b)=>a.gen-b.gen||a.bornAt-b.bornAt||a.id.localeCompare(b.id));
 const living=sorted.filter(r=>r.deadAt===null);
 const matches=(r:MemorialRecord)=>r.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
 const selected=records[familyId??focusedId??'']??living[0]??sorted[0];
 const children=selected?sorted.filter(r=>r.motherId===selected.id||r.fatherId===selected.id):[];
 const generations=[...new Set(children.map(r=>r.gen))].sort((a,b)=>a-b);
 function choose(id:string){setFamilyId(id);if(records[id]?.deadAt===null)focus(id);}
 function card(r:MemorialRecord,central=false){
  const coat=coatFor(r.id,r.coatBucket);
  return <button key={r.id} className={'family-card'+(central?' family-card-selected':'')} onClick={()=>choose(r.id)} aria-current={central?'true':undefined}>
   <i aria-hidden="true" style={{background:coat.color}}/>
   <span><strong>{r.name}</strong><small>{r.sex==='F'?tr('Female','雌性'):tr('Male','雄性')} · {tr('Generation','世代')} {r.gen}</small><small>{r.deadAt===null?tr('Alive','存活'):tr('Deceased','已故')}{r.gen===0?tr(' · Founder',' · 创始成员'):''}</small></span>
  </button>;
 }
 function parent(id:string|null,label:string){
  return <div className="family-parent"><h4>{label}</h4>{id&&records[id]?card(records[id]):<p className="family-empty">{id?tr('Parent not recorded','未记录父母'):selected?.gen===0?tr('Founder · no earlier ancestry','创始成员，无更早谱系'):tr('Parent unknown','父母未知')}</p>}</div>;
 }
 return <div className="lineage">
  <div className="panel-head"><strong>{tr('Residents','居民')}</strong><span className="dim">{living.length} {tr('alive','存活')}</span></div>
  <label className="family-search">{tr('Find a rat','查找大鼠')}<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={tr('Search by name…','按名字搜索…')}/></label>
  <div className="production-residents" aria-label={tr('Living rats','存活的大鼠')}>
   {living.filter(matches).map(r=><button key={r.id} aria-pressed={focusedId===r.id} onClick={()=>{setFamilyId(r.id);focus(r.id);}}>
    <i style={{background:coatFor(r.id,r.coatBucket).color}}/><span>{r.name}<small>{r.sex==='F'?tr('Female','雌性'):tr('Male','雄性')} · {tr('Generation','世代')} {r.gen}</small></span>
   </button>)}
   {!living.some(matches)&&<p className="family-empty">{tr('No living rats match this name.','没有匹配的存活大鼠。')}</p>}
  </div>
  <details className="readout-details family-view">
   <summary>{tr('Family tree','家族谱系')}</summary>
   <div className="family-content">
    <p className="family-intro">{tr('Read from top to bottom: parents → selected rat → children. Select any name to explore that family.','从上到下：父母 → 选中的大鼠 → 子代。点击名字查看其家族。')}</p>
    <label>{tr('Whose family?','查看谁的家族？')}<select value={selected?.id??''} onChange={e=>choose(e.target.value)} aria-label={tr('Choose family member','选择家族成员')}>
     {sorted.filter(r=>matches(r)||r.id===selected?.id).map(r=><option key={r.id} value={r.id}>{r.name} · G{r.gen}{r.deadAt!==null?tr(' · deceased',' · 已故'):''}</option>)}
    </select></label>
    {focusedId&&selected?.id!==focusedId&&records[focusedId]&&<button className="chip" onClick={()=>setFamilyId(focusedId)}>{tr('Show selected rat’s family','查看选中大鼠的家族')}</button>}
    {selected?<><section className="family-level"><h3>{tr('1 · Parents','1 · 父母')}</h3>
     {parent(selected.motherId,tr('Mother','母亲'))}{parent(selected.fatherId,tr('Father','父亲'))}
    </section><div className="family-flow" aria-hidden="true">↓</div>
    <section className="family-level"><h3>{tr('2 · Selected rat','2 · 选中的大鼠')}</h3>{card(selected,true)}</section>
    <div className="family-flow" aria-hidden="true">↓</div>
    <section className="family-level"><h3>{tr('3 · Children','3 · 子代')} ({children.length})</h3>
     <p className="family-count">{children.filter(r=>r.deadAt===null).length} {tr('alive','存活')} · {children.filter(r=>r.deadAt!==null).length} {tr('deceased','已故')}</p>
     {generations.map(gen=><details className="family-generation" key={gen} open={generations.length===1}><summary>{tr('Generation','世代')} {gen} · {children.filter(r=>r.gen===gen).length}</summary>{children.filter(r=>r.gen===gen).map(r=>card(r))}</details>)}
     {!children.length&&<p className="family-empty">{tr('No recorded children.','暂无子代记录。')}</p>}
    </section><p className="family-intro">{tr('Both maternal and paternal links are shown. Deceased relatives remain in the family history.','同时显示母系和父系关系。已故亲属保留在家族历史中。')}</p></>:<p>{tr('No family records yet.','暂无家族记录。')}</p>}
   </div>
  </details>
 </div>;
}