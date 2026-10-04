import {useSeasonResult} from '../season/resultState';
import {tr,useLanguage} from '../i18n';
import {useSeason} from '../seasonState';
import {useSeasonVisual,type NestId} from '../season/visualState';
export default function SeasonLiveSummary(){useLanguage(s=>s.language);const {snapshot,available}=useSeason();const result=useSeasonResult(s=>s.result);return <div className="season-live-summary">
 <div className="season-live-scores" aria-label={tr('Nest standings','巢穴排名')}>{(['NVDA','AAPL','AMZN'] as NestId[]).map((id,i)=><button key={id} onClick={()=>useSeasonVisual.getState().focusNest(id)} title={tr('View nest','查看巢穴')}><span>{id}</span><strong>{result?.phase==='complete'?String(Number(result.ranking.find(r=>r.ticker===id)!.finalHalves)/2):snapshot?.nests[i]?snapshot.nests[i].score+(snapshot.nests[i].halfPoint?'.5':''):'—'}</strong><small>{tr('points · view','积分 · 查看')}</small></button>)}</div>
 {!available&&<small>{tr('Waiting for the latest scores','等待最新积分')}</small>}
 <section className="season-live-prize" aria-label={tr('Weekly prize','每周奖金')}><span>{tr('WEEKLY PRIZE','每周奖金')}</span><strong>$1,000 <em>+ {tr('weekly fees','每周手续费')}</em></strong><p>{tr('Announced opening contribution + 70% of the week’s fees. Paid in the winning nest’s Stock Token.','已公布的初始奖励 + 本周手续费的70%。以获胜巢穴的股票代币支付。')}</p><small>{tr('Weekly fee total: awaiting reconciliation','每周手续费总额：待核算')}</small></section>
 </div>;}
