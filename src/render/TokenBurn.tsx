import {useStore} from '../store';
import {tr,locale,useLanguage} from '../i18n';
import {tokenBurn} from '../market/tokenBurn';
export default function TokenBurn(){
 useLanguage(s=>s.language);
 const burn=tokenBurn(useStore(s=>s.chain));
 const percent=burn===null?'—':burn.percent>0&&burn.percent<.0001?'<0.0001%':burn.percent.toLocaleString(locale(),{minimumFractionDigits:2,maximumFractionDigits:4})+'%';
 return <span className="token-burn" title={tr('Share of the original 1 billion RATTERY removed from total supply by burns. Transfers to dead addresses are not included.','通过销毁从初始10亿枚RATTERY总供应量中移除的比例。不包括转入销毁地址的代币。')}><span aria-hidden="true">◈</span> {tr('Supply burned','已销毁供应量')} <strong>{percent}</strong><small>{burn===null?tr('Data unavailable','数据暂不可用'):burn.amount.toLocaleString(locale(),{maximumFractionDigits:2})+' RATTERY'}</small></span>;
}
