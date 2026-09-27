import {useCallback,useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {tr,useLanguage} from '../i18n';
import {useStore} from '../store';
import {cueStage,type StageCue} from './tutorialStage';

/*
 * Season I guided tutorial. Content follows RATTERY-SEASON-1-WHITEPAPER v0.1 (beta).
 * A spotlight travels to the panel being explained and the card flies beside it.
 * Presentation only: it reads no sim state and triggers no payment.
 */

type Pair=[string,string];
type Step={id:string;chapter:Pair;title:Pair;body:()=>ReactNode;targets?:string[];panel?:'colony'|'residents';cue?:StageCue};

const T=(p:Pair)=>tr(p[0],p[1]);
const NESTS:[string,string,string][]=[['A','NVIDIA','#91cf36'],['B','Apple','#dce6f0'],['C','Amazon','#ffae43']];

function Nests(){return <div className="stut-nests">{NESTS.map(([l,n,c])=><span key={n} style={{'--c':c} as CSSProperties}><b>{l}</b>{n}</span>)}</div>;}
function Price({usd,children}:{usd:number;children:ReactNode}){return <div className="stut-price"><b>USD {usd}</b><span>{children}</span></div>;}
function List({items}:{items:ReactNode[]}){return <ul className="stut-list">{items.map((x,i)=><li key={i}>{x}</li>)}</ul>;}
function Note({children}:{children:ReactNode}){return <p className="stut-note">{children}</p>;}
function Rows({rows,head}:{rows:ReactNode[][];head?:ReactNode[]}){return <table className="stut-table">{head&&<thead><tr>{head.map((h,i)=><th key={i}>{h}</th>)}</tr></thead>}<tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table>;}
function Split({parts}:{parts:[number,string,string][]}){return <div className="stut-split">{parts.map(([v,label,c])=><span key={label} style={{flexGrow:v,'--c':c} as CSSProperties}><b>{v}%</b><small>{label}</small></span>)}</div>;}
function Formula({children}:{children:ReactNode}){return <div className="stut-formula">{children}</div>;}

const STEPS:Step[]=[
 {id:'intro',chapter:['Welcome','欢迎'],title:['Three nests. One week. One winner.','三个巢穴，一周，一位赢家。'],targets:['.season-rail','.season-nav-button'],cue:{nest:null},body:()=><>
  <p>{tr('Season I turns the colony into a weekly competition on Robinhood Chain. You join the nest of NVIDIA, Apple or Amazon, burn RATTERY to act, and the winning nest shares a prize paid in that company\'s Stock Token.','第一赛季把群落变成Robinhood Chain上的每周竞赛。你加入NVIDIA、Apple或Amazon的巢穴，销毁RATTERY进行操作，获胜巢穴将分享以该公司Stock Token支付的奖金。')}</p>
  <Nests/>
  <p>{tr('Holders get a separate share, even without playing.','持有者即使不参赛，也可获得单独的一份奖励。')}</p>
  <Note>{tr('Beta rules from whitepaper v0.1. The launch date is announced separately.','规则来自白皮书v0.1测试版。上线日期将另行公布。')}</Note></>},
 {id:'nests',chapter:['The nests','巢穴'],title:['Each nest is home to a resident couple','每个巢穴都住着一对居民'],targets:['.nest-preview-cards'],cue:{nest:null},body:()=><>
  <p>{tr('Points build the nest. Players can feed their own nest, protect it with a shield or attack a rival nest.','积分让巢穴成长。玩家可以喂养自己的巢穴、用护盾保护它，或攻击对手巢穴。')}</p>
  <List items={[tr('Snake attacks and point losses never kill resident rats.','蛇的攻击和积分损失永远不会杀死居民大鼠。'),tr('Permanent residents keep their identities and protection.','永久居民保留其身份与保护。'),tr('One active nest membership per wallet.','每个钱包只能有一个有效的巢穴成员资格。')]}/></>},
 {id:'clock',chapter:['The weekly clock','每周时间表'],title:['Every week is a new competition','每周都是一场新的竞赛'],targets:['.season-status','.season-rail','.season-nav-button'],body:()=><>
  <ol className="stut-timeline">
   <li><b>{tr('Mon 13:00','周一 13:00')}</b><span>{tr('Competition opens','竞赛开启')}</span></li>
   <li><b>{tr('Sun 19:00','周日 19:00')}</b><span>{tr('Nest switching closes','停止更换巢穴')}</span></li>
   <li><b>{tr('Mon 00:00','周一 00:00')}</b><span>{tr('Gameplay closes','竞赛结束')}</span></li>
   <li><b>{tr('Mon morning','周一上午')}</b><span>{tr('Result and payments, after reconciliation','对账后公布结果并支付')}</span></li>
  </ol>
  <Note>{tr('All times are São Paulo time. First-time entrants can join until gameplay closes. A payment delay never reopens a closed week.','所有时间均为圣保罗时间。首次参与者可在竞赛结束前加入。支付延迟不会重新开启已结束的一周。')}</Note></>},
 {id:'join',chapter:['Joining','加入'],title:['Pick a nest with your wallet','用钱包选择巢穴'],targets:['.wallet-trigger'],body:()=><>
  <p>{tr('Entry gives your nest 100 points and you 100 contribution units, at any time. Joining later costs more but buys nothing extra.','无论何时加入，入场都会为巢穴带来100积分，并为你带来100贡献单位。越晚加入价格越高，但不会得到额外收益。')}</p>
  <Rows head={[tr('Time left','剩余时间'),tr('Entry','入场费')]} rows={[[tr('More than 72 h','超过72小时'),'USD 10'],[tr('72 to 36 h','72至36小时'),'USD 15'],[tr('36 to 12 h','36至12小时'),'USD 20'],[tr('Final 12 h','最后12小时'),'USD 30']]}/>
  <Note>{tr('Switching nests means paying the current entry again. Points you produced stay with the old nest, and that membership\'s reward rights are lost for good.','更换巢穴需要再次支付当前入场费。你产生的积分留在原巢穴，该成员资格的奖励权利将永久失去。')}</Note></>},
 {id:'burn',chapter:['Paying','支付'],title:['Priced in dollars, paid by burning RATTERY','以美元定价，通过销毁RATTERY支付'],targets:['.chip-trade','.ca-chip'],body:()=><>
  <p>{tr('Every action has a fixed USD price. The RATTERY amount comes from the live pool price and is shown exactly before you confirm. A quote lasts 60 seconds.','每项操作都有固定的美元价格。RATTERY数量根据实时池价格计算，并在确认前精确显示。报价有效期为60秒。')}</p>
  <List items={[tr('Entries, feeds, shields and attacks all burn RATTERY. Burned tokens are not prize money.','入场、喂养、护盾和攻击都会销毁RATTERY。被销毁的代币不属于奖金。'),tr('A rejected or expired action burns nothing. A failed transaction can still cost network gas.','被拒绝或过期的操作不会销毁任何代币，但失败的交易仍可能产生网络费用。'),tr('If the price feed is stale, new quotes pause.','价格数据过时时，暂停新的报价。')]}/></>},
 {id:'feed',chapter:['Actions · 1 of 3','操作 · 1/3'],title:['Feed: grow your nest','喂养：让巢穴成长'],targets:['.nest-card[data-nest="NVDA"] [aria-label="Feed +20"]','.nest-card[data-nest="NVDA"]'],cue:{nest:'NVDA',play:'feed'},body:()=><>
  <Price usd={2}>{tr('+20 nest points · +20 contribution units','+20巢穴积分 · +20贡献单位')}</Price>
  <p>{tr('Besides entry, feeding is the only action that increases your share of the prize. It is the steady way to build.','除入场外，喂养是唯一能增加你奖金份额的操作，是稳定积累的方式。')}</p></>},
 {id:'shield',chapter:['Actions · 2 of 3','操作 · 2/3'],title:['Shield: block one attack','护盾：挡住一次攻击'],targets:['.nest-card[data-nest="AAPL"] [aria-label="Shield FX"]','.nest-card[data-nest="AAPL"]'],cue:{nest:'AAPL',play:'shield'},body:()=><>
  <Price usd={10}>{tr('Protects the whole nest from one complete attack','为整个巢穴挡住一次完整攻击')}</Price>
  <List items={[tr('Lasts 15 minutes unless an attack uses it first.','持续15分钟，除非提前被攻击消耗。'),tr('Only one active shield. No stacking, no extending.','同时只能有一个护盾，不可叠加或延长。'),tr('The nest shares a 30 minute cooldown from the last activation.','巢穴共享30分钟冷却，从上次激活起计算。'),tr('Gives no points and no contribution units.','不产生积分，也不产生贡献单位。')]}/></>},
 {id:'attack',chapter:['Actions · 3 of 3','操作 · 3/3'],title:['Attack: release the snake','攻击：放出蛇'],targets:['.nest-card[data-nest="AMZN"] [aria-label="Attack FX"]','.nest-card[data-nest="AMZN"]'],cue:{nest:'AMZN',play:'attack'},body:()=><>
  <Price usd={20}>{tr('Removes 10% of a rival\'s current score, rounded down, max 500','移除对手当前积分的10%，向下取整，最多500')}</Price>
  <div className="stut-example"><span>237 {tr('pts','分')}</span><i aria-hidden="true">→</i><b>−23</b><small>{tr('Under 10 points loses nothing.','低于10分则不损失。')}</small></div>
  <List items={[tr('Removed points vanish. The attacker gains nothing.','被移除的积分直接消失，攻击方不会获得。'),tr('Each attacking nest shares a 60 minute cooldown, even if a shield blocked it.','每个攻击方巢穴共享60分钟冷却，即使被护盾挡住。'),tr('Attacks settle in blockchain order. A later shield cannot undo them.','攻击按区块链顺序结算，之后的护盾无法撤销。'),tr('Attacks cut the nest score, never the contribution members already earned.','攻击只减少巢穴积分，不会减少成员已获得的贡献。')]}/></>},
 {id:'mood',chapter:['Scoring','计分'],title:['A calm colony earns, a stressed one bleeds','平静的群落得分，紧张的群落失分'],targets:['#condition-panel .condition-grid','#condition-panel'],panel:'colony',body:()=><>
  <p>{tr('Every 10 minutes each nest gains or loses points from the colony\'s average stress and its company\'s stock versus the previous close.','每10分钟，各巢穴会根据群落平均压力及其公司股价相对前一收盘价的变化获得或失去积分。')}</p>
  <div className="stut-moods"><span data-m="happy"><b>{tr('Happy','愉快')}</b>{tr('stress under 30%','压力低于30%')}</span><span data-m="neutral"><b>{tr('Neutral','中性')}</b>{tr('30 to 45%','30%至45%')}</span><span data-m="stressed"><b>{tr('Stressed','紧张')}</b>{tr('45% or more','45%及以上')}</span></div>
  <Rows head={['',tr('Stock up','股价上涨'),tr('Flat or closed','持平或休市'),tr('Stock down','股价下跌')]} rows={[[tr('Happy','愉快'),'+2','+1','+0.5'],[tr('Neutral','中性'),'0','0','0'],[tr('Stressed','紧张'),'−0.5','−1','−2']]}/>
  <Note>{tr('Points per 10 minutes. Outside regular trading hours the stock effect is neutral. Timing details are finalized before launch.','每10分钟的积分。常规交易时段以外，股价影响为中性。具体时间细节将在上线前确定。')}</Note></>},
 {id:'stock',chapter:['Scoring','计分'],title:['The weekly stock bonus','每周股价调整'],targets:['.nest-preview-cards'],cue:{nest:null},body:()=><>
  <Formula><span>{tr('Weekly return %','周收益率%')}</span><i>×</i><b>10</b><i>=</i><span>{tr('points','积分')}</span></Formula>
  <div className="stut-pair"><span className="up">+2% → <b>+20</b></span><span className="down">−2% → <b>−20</b></span></div>
  <p>{tr('Applied once at settlement, from the Friday close before the week to the Friday close within it. It is not multiplied by score or players, and it has no cap.','在结算时一次性计入，按本周前一个周五收盘价到本周周五收盘价计算。不按积分或人数放大，也没有上限。')}</p>
  <Note>{tr('Final scores never go below zero.','最终积分不会低于零。')}</Note></>},
 {id:'winner',chapter:['Winning','获胜'],title:['Highest score wins','最高分获胜'],targets:['.nest-preview-cards','.season-rail','.season-nav-button'],cue:{nest:'NVDA',play:'winner'},body:()=><>
  <p>{tr('If nests tie, the order is:','如果出现平局，依次比较：')}</p>
  <ol className="stut-steps"><li>{tr('Most points produced by entries and feeds.','入场和喂养产生的积分最多者。')}</li><li>{tr('The nest that reached that total first on chain.','在链上最先达到该总数的巢穴。')}</li><li>{tr('Season I priority: NVIDIA, Apple, Amazon.','第一赛季优先顺序：NVIDIA、Apple、Amazon。')}</li></ol>
  <Note>{tr('The crown shown here is a scene demo, not a prediction.','此处的王冠仅为场景演示，并非预测。')}</Note></>},
 {id:'pot',chapter:['Rewards','奖励'],title:['Where the prize comes from','奖金来源'],targets:['.season-rail','.season-nav-button'],body:()=><>
  <p>{tr('Season I opens with a committed 1,000 USDC, plus 70% of the weekly ETH fees the project receives.','第一赛季以承诺的1,000 USDC开启，另加项目每周收到的ETH手续费的70%。')}</p>
  <Split parts={[[70,tr('Prizes','奖金'),'#e8c36a'],[15,tr('Buyback & burn','回购销毁'),'#ef7a5a'],[15,tr('Team & infra','团队与基础设施'),'#7f8d86']]}/>
  <p>{tr('Prize money is then split:','奖金再分配为：')}</p>
  <Split parts={[[80,tr('Winning players','获胜玩家'),'#91cf36'],[20,tr('Holders','持有者'),'#8fb8e8']]}/>
  <Note>{tr('Both are paid in the winning company\'s Stock Token. The 1,000 USDC is a commitment, not yet a verified deposit.','两部分均以获胜公司的Stock Token支付。1,000 USDC为承诺金额，尚非已验证的存款。')}</Note></>},
 {id:'share',chapter:['Rewards','奖励'],title:['Your share if your nest wins','巢穴获胜时你的份额'],targets:['.wallet-trigger'],body:()=><>
  <Formula><span>{tr('Weight','权重')}</span><i>=</i><span>{tr('your contribution','你的贡献')}</span><i>×</i><span>(1 + {tr('holder bonus','持有奖励')} + {tr('burner bonus','销毁奖励')})</span></Formula>
  <p>{tr('The 80% pool is shared in proportion to each winning member\'s weight.','80%的奖池按每位获胜成员的权重比例分配。')}</p>
  <List items={[tr('Only entry and feeding create contribution. Shields and attacks do not.','只有入场和喂养产生贡献，护盾和攻击不产生。'),tr('A losing membership gets no active prize, but the wallet may still earn as a holder.','失败方的成员资格没有主动奖金，但钱包仍可能作为持有者获得奖励。'),tr('No per-wallet cap: large contributions can win large shares.','每个钱包没有上限：大额贡献可能获得大额份额。')]}/></>},
 {id:'hold',chapter:['Rewards','奖励'],title:['Just holding counts too','仅持有也有奖励'],targets:['.chip-trade','.ca-chip'],body:()=><>
  <p>{tr('The 20% holder pool follows your time-weighted average RATTERY balance from Monday 13:00 to the next Monday 00:00. Minimum average: USD 25, fixed in RATTERY when the season opens. LP positions do not count.','20%的持有者奖池按你从周一13:00到下周一00:00的时间加权平均RATTERY余额分配。最低平均余额：25美元，于赛季开启时换算为固定RATTERY数量。流动性池仓位不计入。')}</p>
  <Rows head={[tr('Held above USD 100 at opening','开赛时持有超过100美元'),tr('Bonus','奖励')]} rows={[[tr('7 days','7天'),'+2%'],[tr('14 days','14天'),'+3%'],[tr('30 days','30天'),'+5%']]}/>
  <p>{tr('Burned 1,000,000+ RATTERY before Season I? You start with +5%, growing one point per qualifying season up to +15%.','在第一赛季前已销毁1,000,000以上RATTERY？初始奖励+5%，每个达标赛季增加一个百分点，最高+15%。')}</p>
  <Note>{tr('Bonuses add up to +20% and only boost the winning players\' weight, not nest points or the holder pool.','奖励合计最高+20%，只提升获胜玩家的权重，不影响巢穴积分或持有者奖池。')}</Note></>},
 {id:'rats',chapter:['The colony','群落'],title:['Healthy rats protect your score','健康的大鼠守护你的积分'],targets:['.rat-tour','.colony-navigation'],body:()=><>
  <p>{tr('Colony stress moves every nest\'s points every 10 minutes. Meet the residents, step through them with Previous and Next, and watch Colony status for alerts.','群落压力每10分钟影响所有巢穴的积分。认识居民，用“上一个/下一个”逐一查看，并关注群落状态中的警报。')}</p></>},
 {id:'fine',chapter:['Before you play','参与之前'],title:['Know the fine print','了解细则'],body:()=><>
  <List items={[tr('Paid play opens only after pricing, gameplay and automated settlement are ready. The launch date is announced separately.','只有在定价、玩法和自动结算准备就绪后才会开放付费参与。上线日期另行公布。'),tr('Stock Tokens give economic exposure to the company, not ownership of its shares. Issuer conditions apply.','Stock Token提供公司的经济敞口，并非股票所有权。须符合发行方条件。'),tr('Every burn is permanent. Only spend what you are comfortable losing.','每次销毁都是永久的。请只投入你能承受损失的金额。'),tr('This guide explains the rules. It is not financial advice.','本指南仅解释规则，并非投资建议。')]}/></>},
];

const GAP=18,MARGIN=12,PAD=8;
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

function findTarget(selectors?:string[]){
 for(const s of selectors??[])for(const el of document.querySelectorAll(s)){
  const r=el.getBoundingClientRect();if(r.width<4||r.height<4)continue;
  const cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.display==='none')continue;
  if(r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth)continue;
  return {el:el as HTMLElement,r};
 }
 return null;
}

export default function SeasonTutorial({onClose}:{onClose:()=>void}){
 useLanguage(s=>s.language);
 const [index,setIndex]=useState(0);
 const step=STEPS[index],last=index===STEPS.length-1;
 const card=useRef<HTMLDivElement>(null),spot=useRef<HTMLDivElement>(null),next=useRef<HTMLButtonElement>(null);
 const placed=useRef(false);

 const go=useCallback((to:number)=>setIndex(Math.max(0,Math.min(STEPS.length-1,to))),[]);

 // Panels must be visible while the guide points at them; restore the visitor's choice afterwards.
 useEffect(()=>{const was=useStore.getState().cinema;if(was)useStore.setState({cinema:false});document.documentElement.classList.add('stut-open');
  return()=>{document.documentElement.classList.remove('stut-open');cueStage({nest:null});if(was)useStore.setState({cinema:true});};},[]);

 useEffect(()=>{
  if(step.panel)useStore.getState().openPanel(step.panel);
  if(step.cue)cueStage(step.cue);
  const t=setTimeout(()=>findTarget(step.targets)?.el.scrollIntoView({block:'nearest',inline:'nearest',behavior:reduced()?'auto':'smooth'}),60);
  next.current?.focus({preventScroll:true});
  if(placed.current&&!reduced())card.current?.animate([{scale:1},{scale:.965,offset:.35},{scale:1}],{duration:620,easing:'cubic-bezier(.2,.8,.2,1)'});
  return()=>clearTimeout(t);
 },[step]);

 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();onClose();}
   else if(e.key==='ArrowRight'){e.preventDefault();go(index+1);}
   else if(e.key==='ArrowLeft'){e.preventDefault();go(index-1);}
   else return;
   e.stopImmediatePropagation();
  };
  window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);
 },[index,go,onClose]);

 // Follow the target every frame: panels animate, scroll and resize while the guide is open.
 useLayoutEffect(()=>{
  let raf=0;
  const layout=()=>{
   const c=card.current,s=spot.current;if(!c||!s)return;
   const vw=innerWidth,vh=innerHeight,cw=c.offsetWidth,ch=c.offsetHeight,t=findTarget(step.targets);
   let x=(vw-cw)/2,y=(vh-ch)/2,side='none',ax=0,ay=0;
   if(t){
    const r={left:t.r.left-PAD,top:t.r.top-PAD,right:t.r.right+PAD,bottom:t.r.bottom+PAD};
    const w=r.right-r.left,h=r.bottom-r.top,cx=r.left+w/2,cy=r.top+h/2;
    s.style.cssText=`left:${r.left}px;top:${r.top}px;width:${w}px;height:${h}px`;s.dataset.on='';
    const room={right:vw-r.right,left:r.left,bottom:vh-r.bottom,top:r.top};
    const order=(['right','left','bottom','top'] as const).filter(k=>k==='right'||k==='left'?room[k]>=cw+GAP+MARGIN:room[k]>=ch+GAP+MARGIN).sort((a,b)=>room[b]-room[a]);
    const pick=order.find(k=>k==='right'||k==='left')&&(w<vw*.5)?order.find(k=>k==='right'||k==='left'):order[0];
    if(pick==='right'){x=r.right+GAP;y=cy-ch/2;}
    else if(pick==='left'){x=r.left-GAP-cw;y=cy-ch/2;}
    else if(pick==='bottom'){y=r.bottom+GAP;x=cx-cw/2;}
    else if(pick==='top'){y=r.top-GAP-ch;x=cx-cw/2;}
    else{y=vh-ch-MARGIN;}
    side=pick??'over';
    x=Math.round(Math.max(MARGIN,Math.min(vw-cw-MARGIN,x)));y=Math.round(Math.max(MARGIN,Math.min(vh-ch-MARGIN,y)));
    ax=Math.round(Math.max(20,Math.min(cw-20,cx-x)));ay=Math.round(Math.max(20,Math.min(ch-20,cy-y)));
   }else{
    s.style.cssText=`left:${vw/2}px;top:${vh/2}px;width:0px;height:0px`;delete s.dataset.on;
    x=Math.round(x);y=Math.round(y);
   }
   c.style.transform=`translate3d(${x}px,${y}px,0)`;c.dataset.side=side;c.style.setProperty('--ax',`${ax}px`);c.style.setProperty('--ay',`${ay}px`);
   if(!placed.current){placed.current=true;requestAnimationFrame(()=>c.classList.add('is-placed'));}
   raf=requestAnimationFrame(layout);
  };
  layout();return()=>cancelAnimationFrame(raf);
 },[step]);

 return createPortal(<div className="stut" data-step={step.id}>
  <div className="stut-block" aria-hidden="true"/>
  <div ref={spot} className="stut-spot" aria-hidden="true"/>
  <div ref={card} className="stut-card" role="dialog" aria-modal="true" aria-labelledby="stut-title">
   <i className="stut-arrow" aria-hidden="true"/>
   <header className="stut-head">
    <span className="stut-kicker">Season I · {T(step.chapter)}</span>
    <button type="button" className="stut-close" onClick={onClose} aria-label={tr('Close tutorial','关闭教程')}>×</button>
   </header>
   <div className="stut-progress" aria-hidden="true">{STEPS.map((s,i)=><i key={s.id} data-done={i<index||undefined} data-now={i===index||undefined}/>)}</div>
   <div className="stut-content" key={step.id} aria-live="polite">
    <h2 id="stut-title">{T(step.title)}</h2>
    <div className="stut-body">{step.body()}</div>
   </div>
   <footer className="stut-foot">
    <span className="stut-count">{index+1} / {STEPS.length}</span>
    <div>
     {index>0&&<button type="button" className="stut-back" onClick={()=>go(index-1)}><span aria-hidden="true">←</span> {tr('Back','上一步')}</button>}
     <button ref={next} type="button" className="stut-next" onClick={()=>last?onClose():go(index+1)}>{last?tr('Finish','完成'):tr('Next','下一步')} {!last&&<span aria-hidden="true">→</span>}</button>
    </div>
   </footer>
  </div>
 </div>,document.body);
}
