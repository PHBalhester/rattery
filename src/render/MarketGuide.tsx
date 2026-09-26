import {tr,useLanguage} from '../i18n';

/**
 * The market -> colony contract in one glance. Mirrors the live mapping
 * (sim/marketMap.ts): buys raise food, water and warmth; sells drain them and
 * add stress; silence slowly decays resources. Wording only, no numbers, so it
 * stays true when coefficients are recalibrated.
 */
export default function MarketGuide({compact=false}:{compact?:boolean}){
 useLanguage(s=>s.language);
 return <div className={`market-guide${compact?' market-guide-compact':''}`} role="group" aria-label={tr('How trades affect the colony','交易如何影响群落')}>
  {!compact&&<div className="market-guide-title">{tr('How trades affect the colony','交易如何影响群落')}</div>}
  <div className="market-guide-row">
   <div className="market-guide-card is-buy">
    <b>▲ {tr('Buy','买入')}</b>
    <span>{tr('More food, water and warmth. Rats explore and play.','更多食物、饮水和温暖。大鼠更爱探索和玩耍。')}</span>
   </div>
   <div className="market-guide-card is-sell">
    <b>▼ {tr('Sell','卖出')}</b>
    <span>{tr('Resources drain and stress rises. Rats hide in the nest.','资源减少，压力上升。大鼠躲回巢穴。')}</span>
   </div>
  </div>
  <p className="market-guide-quiet"><b>● {tr('Quiet market','市场平静')}</b> {tr('Resources slowly fade. Bigger trades cause bigger reactions.','资源会缓慢减少。交易越大，反应越强。')}</p>
 </div>;
}
