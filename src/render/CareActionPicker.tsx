import {CARE_RULES,type CareAction} from '../sim/care';
import {tr,locale,useLanguage} from '../i18n';

export const CARE_ICONS:Record<CareAction,string>={feed:'🍎',water:'💧',pet:'🤲',play:'🎾',treat:'🍬',explore:'🧭',mint:'🏷️',name:'✏️',prosocial:'🤝',aggression:'😠',snake:'🐍'};
export const CARE_LABELS:Record<CareAction,[string,string]>={snake:['Awaken snake','唤醒蛇'],mint:['Mint & name','铸造并命名'],name:['Rename','重命名'],feed:['Feed','喂食'],water:['Water','饮水'],pet:['Pet','抚摸'],play:['Play','玩耍'],treat:['Treat','零食'],explore:['Explore','探索'],prosocial:['Sociability','社交增强'],aggression:['Irritability','易怒增强']};
const BLURBS:Record<CareAction,[string,string]>={
 feed:['+15 energy','+15能量'],
 water:['+15 hydration','+15水分'],
 pet:['Calms stress','缓解压力'],
 play:['Lowers cortisol','降低皮质醇'],
 treat:['+energy, +dopamine','+能量，+多巴胺'],
 explore:['Ends rest, can explore','结束休息，可再探索'],
 mint:['Own it. Not an NFT','拥有它，不是NFT'],
 name:['Free','免费'],
 prosocial:['Friendlier for 2h','2小时内更友善'],
 aggression:['More irritable for 2h','2小时内更易怒'],
 snake:['Can kill a rat','可能杀死大鼠'],
};
const GROUPS:{id:string;title:[string,string];actions:CareAction[]}[]=[
 {id:'care',title:['Everyday care','日常照护'],actions:['feed','water','pet','play','treat','explore']},
 {id:'identity',title:['Ownership','所有权'],actions:['mint','name']},
 {id:'advanced',title:['Behaviour boosters · adults','行为增强 · 成年个体'],actions:['prosocial','aggression']},
 {id:'danger',title:['Danger','危险'],actions:['snake']},
];

type Props={
 owned:boolean;
 selected?:CareAction|null;
 suggested?:CareAction[];
 disabled?:(action:CareAction)=>boolean;
 note?:(action:CareAction)=>string|undefined;
 onPick:(action:CareAction)=>void;
};

/** Grouped, self-explaining care buttons. Selection only: callers keep their own payment flow. */
export default function CareActionPicker({owned,selected,suggested=[],disabled,note,onPick}:Props){
 useLanguage(s=>s.language);
 return <div className="care-picker">{GROUPS.map(group=>{
  const actions=group.actions.filter(a=>owned?a!=='mint':a!=='name');
  if(!actions.length)return null;
  return <fieldset key={group.id} className={`care-group care-group-${group.id}`}><legend>{tr(...group.title)}</legend><div className="care-grid">
   {actions.map(action=>{const cost=CARE_RULES[action].cost,extra=note?.(action),recommended=suggested.includes(action);
    return <button type="button" key={action} className="care-option" aria-pressed={selected===action} data-suggested={recommended||undefined} disabled={disabled?.(action)} onClick={()=>onPick(action)}>
     <span className="care-option-top"><span aria-hidden="true" className="care-icon">{CARE_ICONS[action]}</span><strong>{tr(...CARE_LABELS[action])}</strong>{recommended&&<em>{tr('Needed','需要')}</em>}</span>
     <small>{tr(...BLURBS[action])}</small>
     <small className="care-cost">{cost?`${cost.toLocaleString(locale())} RATTERY`:tr('Free','免费')}{extra?` · ${extra}`:''}</small>
    </button>;})}
  </div></fieldset>;})}
 </div>;
}
