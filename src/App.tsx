import {tr,useLanguage} from './i18n';
import { useEffect, useState } from "react";
import { getWorld, startEngine, useCA, useStore } from "./store";
import Burrow from "./render/Burrow3D";
import ColonyPanel from "./render/ColonyPanel";
import LineageTree from "./render/LineageTree";
import Hud from "./render/Hud";
import TradeTape from "./render/TradeTape";
import WalletConnection from "./render/WalletConnection";
import AmbientAudio from "./render/AmbientAudio";
import { SITE, ponsUrl } from "./config";
import { truncateCA } from "./copy/pons";


export default function App() {
  const {language,setLanguage}=useLanguage();
  useEffect(()=>{document.documentElement.lang=language==='zh'?'zh-Hans':'en';},[language]);
  const staging = import.meta.env.VITE_STAGING === "true";
  const cinema = useStore((s) => s.cinema);
  const toggleCinema = useStore((s) => s.toggleCinema);
  const version = useStore((s) => s.version);
  const ca = useCA();
  const chain=useStore(s=>s.chain);
  const testnet=chain?.chainId===46630;
  const feedStatus = useStore((s) => s.feedStatus);
  const [copied, setCopied] = useState(false);
  void version;

  useEffect(() => { startEngine(); }, []);

  const simDay = Math.floor(getWorld().simDay);
  const feedLabel = feedStatus === "demo" ? tr("Demo","演示") : feedStatus === "catchup" ? tr("Replaying","重建中") : feedStatus === "live" ? tr("Live","实时") : feedStatus === "history-limit" ? tr("History limit","历史限制") : feedStatus === "error" ? tr("Disconnected","连接中断") : tr("Connecting","连接中");

  const copyCA = async () => {
    if (!ca) return;
    try {
      await navigator.clipboard.writeText(ca);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* address remains available in the title */ }
  };

  return (
    <div className={`app colony-app${cinema ? " cinema" : ""}`}>
      <main className="colony-viewport" id="observatory">
        <section className="colony-scene" aria-label="Colony observatory">
          <Burrow />
          {getWorld().extinct && <div className="extinct-note">{tr('The colony has ended.','种群已灭绝。')}</div>}
        </section>

        <header className="topbar floating-panel top-panel">
          <div className="brand">
            <span className="brand-mark">RATTERY{staging&&<small className="staging-label"> · STAGING</small>}</span>
            <span className="brand-tag">{tr('A colony shaped by its environment.','随环境变化的生命群落。')}</span>
          </div>
          <div className="topbar-right"><button type="button" className="language-toggle" aria-label="Language / 语言" aria-pressed={language==='zh'} title={language==='en'?'Switch to Chinese':'切换到英语'} onClick={()=>setLanguage(language==='en'?'zh':'en')}><span className={language==='en'?'active':''}>EN</span><span className={language==='zh'?'active':''}>CH</span></button>
            <span className={`feed-label feed-${feedStatus}`} title={feedStatus === "history-limit" ? "History too long to replay here. Live simulation paused." : undefined}><i />{testnet?`TESTNET · ${feedLabel}`:feedLabel}</span>
            <button className="chip chip-accent" onClick={toggleCinema} aria-pressed={cinema}>{cinema ? tr("Show panels","显示面板") : tr("Hide panels","隐藏面板")}</button>
            <AmbientAudio />
            {ca ? <button className="chip" onClick={copyCA} title={ca}>{copied ? tr('Copied','已复制') : `CA ${truncateCA(ca)}`}</button> : <span className="chip chip-static">{tr('Token pending','代币待发布')}</span>}
            <a className="chip chip-link trade-link" href={testnet?chain!.links.explorer:ponsUrl(ca)} target="_blank" rel="noreferrer">{testnet?tr('Testnet explorer ↗','测试网浏览器 ↗'):tr('Trade ↗','交易 ↗')}</a>
            <WalletConnection />
          </div>
        </header>

        <div className="scene-title">
          <span className="eyebrow">{tr('Observatory / day','观察站／天数')} {simDay}</span>
          <h1>{tr('A living colony.','生机勃勃的群落。')}</h1>
          <p>{tr('Every interaction leaves a story.','每次互动都留下一段故事。')}</p>
        </div>

        <div className="hud-wrap floating-panel"><Hud /></div>

        <div className="panel-deck" aria-label="Colony information panels">
        <aside className="floating-panel colony-panel lineage-panel">
          <LineageTree />
        </aside>

        <aside className="floating-panel colony-panel condition-panel">
          <ColonyPanel />
        </aside>
        </div>

        <div className="habitat-caption floating-caption">
          <span>{tr('3D colony','3D种群')}</span>
          <span>{tr('Drag to orbit · select a rat','拖动旋转视角 · 选择大鼠')}</span>
        </div>

        <div className="tape-wrap floating-panel trade-panel"><TradeTape /><footer className="colony-footer"><span>{staging?tr("STAGING · Demo only · No real payments","测试环境 · 仅演示 · 无真实支付"):tr("RATTERY · A living colony.","RATTERY · 生机勃勃的群落。")}</span><nav aria-label={tr("Project links","项目链接")}><a href={SITE.x} target="_blank" rel="noopener noreferrer">X / Twitter</a><a href={SITE.github} target="_blank" rel="noopener noreferrer">GitHub</a></nav></footer></div>
      </main>
    </div>
  );
}
