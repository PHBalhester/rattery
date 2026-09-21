import {colonyMetrics} from './sim/colonyMetrics';
import {colonyAlerts} from './render/colonyAlerts';
import TokenBurn from './render/TokenBurn';
import WelcomeTour from './render/WelcomeTour';
import {tr,useLanguage} from './i18n';
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getWorld, startEngine, useCA, useStore } from "./store";
import Burrow from "./render/Burrow3D";
import ColonyPanel from "./render/ColonyPanel";
import LineageTree from "./render/LineageTree";
import TradeTape from "./render/TradeTape";
import WalletConnection from "./render/WalletConnection";
import AmbientAudio from "./render/AmbientAudio";
import { SITE, ponsUrl } from "./config";
import { truncateCA } from "./copy/pons";


export default function App() {
  const appRef = useRef<HTMLDivElement>(null);
  const tapeRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const app = appRef.current, tape = tapeRef.current;
    if (!app || !tape) return;
    const measure = () => {
      const bottom = parseFloat(getComputedStyle(tape).bottom) || 0;
      app.style.setProperty('--bottom-chrome', `${Math.ceil(tape.getBoundingClientRect().height + bottom + 12)}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(tape);
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  const {language,setLanguage}=useLanguage();
  useEffect(()=>{document.documentElement.lang=language==='zh'?'zh-Hans':'en';},[language]);
  const staging = import.meta.env.VITE_STAGING === "true";
  const panel = useStore(s=>s.panel);
  const openPanel = useStore(s=>s.openPanel);
  const cinema = useStore((s) => s.cinema);
  const toggleCinema = useStore((s) => s.toggleCinema);
  const version = useStore((s) => s.version);
  const ca = useCA();
  const chain=useStore(s=>s.chain);
  const shared=useStore(s=>s.shared);
  const testnet=chain?.chainId===46630;
  const feedStatus = useStore((s) => s.feedStatus);
  const [copied, setCopied] = useState(false);
  void version;

  useEffect(() => { startEngine(); }, []);

  const world=getWorld();
  const alerts=colonyAlerts(world,colonyMetrics(world));
  const known=feedStatus==="live"||feedStatus==="demo";
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
    <div ref={appRef} className={`app colony-app clear-layout panel-${panel}${cinema ? " cinema" : ""}`}>
      <main className="colony-viewport" id="observatory">
        <section className="colony-scene" aria-label="Colony observatory">
          <Burrow />
          {getWorld().extinct && <div className="extinct-note">{tr('The colony has ended.','种群已灭绝。')}</div>}
        </section>

        <header className="topbar floating-panel top-panel">
          <div className="brand">
            <span className="brand-mark">RATTERY{staging&&<small className="staging-label"> · STAGING</small>}</span>
            <span className="brand-tag">{tr('A shared world of digital rats.','数字大鼠的共享世界。')}</span>
          </div>
          <div className="topbar-right"><button type="button" className="language-toggle" aria-label="Language / 语言" aria-pressed={language==='zh'} title={language==='en'?'Switch to Chinese':'切换到英语'} onClick={()=>setLanguage(language==='en'?'zh':'en')}><span className={language==='en'?'active':''}>EN</span><span className={language==='zh'?'active':''}>CN</span></button>
            <span className={`feed-label feed-${feedStatus}`} title={feedStatus === "history-limit" ? "History too long to replay here. Live simulation paused." : undefined}><i />{shared?tr('Shared · ','共享 · ')+feedLabel:testnet?`TESTNET · ${feedLabel}`:feedLabel}</span>
            <button className="chip chip-accent" onClick={toggleCinema} aria-pressed={cinema}>{cinema ? tr("Show panels","显示面板") : tr("Hide panels","隐藏面板")}</button>
            <AmbientAudio />
            {ca ? <button className="chip" onClick={copyCA} title={ca}>{copied ? tr('Copied','已复制') : `CA ${truncateCA(ca)}`}</button> : <span className="chip chip-static">{tr('Token pending','代币待发布')}</span>}
            <a className="chip chip-link trade-link" href={testnet?chain!.links.explorer:ponsUrl(ca)} target="_blank" rel="noreferrer">{testnet?tr('Testnet explorer ↗','测试网浏览器 ↗'):tr('Trade ↗','交易 ↗')}</a>
            <WalletConnection />
          </div>
        </header>

        <nav className="colony-navigation" aria-label={tr("Explore the colony","探索群落")}>
          <button aria-expanded={!cinema&&panel==="residents"} aria-controls="residents-panel" onClick={()=>openPanel("residents")}>{tr("Meet the rats","认识大鼠")}</button>
          <button aria-expanded={!cinema&&panel!=="residents"} aria-controls="condition-panel" onClick={()=>openPanel("colony")}>{tr("Colony status","群落状态")} · {known?(alerts.length ? alerts.length+" "+tr("alerts","项警报") : tr("No alerts","无警报")):tr("Connecting…","连接中…")}</button>
          <WelcomeTour />
        </nav>
        <div className="scene-title">
          <span className="eyebrow">{tr('Observatory / day','观察站／天数')} {simDay}</span>
          <h1>{tr('A living colony.','生机勃勃的群落。')}</h1>
          <p>{tr('Every interaction leaves a story.','每次互动都留下一段故事。')}</p>
        </div>

        {shared&&<div className="shared-status" role="status" data-revision={shared.revision}>{feedStatus==='error'?tr('Connection delayed · showing the last confirmed state · reconnecting…','连接延迟 · 显示最后确认的状态 · 正在重新连接…'):shared.revision<0?tr('Connecting to the shared colony…','正在连接共享群落…'):staging?tr('Shared staging colony · read-only market feed · payments disabled','共享测试群落 · 只读市场数据 · 支付未启用'):tr('Shared colony · RATTERY on Robinhood Chain','共享群落 · Robinhood Chain上的RATTERY')}{shared.marketHalted&&<strong>{tr(' · Market collection paused',' · 市场数据采集暂停')}</strong>}</div>}


        <div className="panel-deck" aria-label="Colony information panels">
        <aside id="residents-panel" className="floating-panel colony-panel lineage-panel" aria-label={tr("Residents","居民")}>
          <LineageTree />
        </aside>

        <aside id="condition-panel" className="floating-panel colony-panel condition-panel" aria-label={tr("Colony status and care","群落状态与照护")}>
          <ColonyPanel />
        </aside>
        </div>

        <div className="habitat-caption floating-caption">
          <span>{tr('3D colony','3D种群')}</span>
          <span>{tr('Drag to orbit · select a rat','拖动旋转视角 · 选择大鼠')}</span>
        </div>

        <div ref={tapeRef} className="tape-wrap floating-panel trade-panel"><TradeTape /><footer className="colony-footer"><div className="footer-disclaimer"><TokenBurn /><span className="experiment-label">{tr("RATTERY · A digital colony experiment.","RATTERY · 数字群落实验。")}</span><span>{tr("Simulated behavior, not scientific measurements.","行为为模拟，并非科学测量结果。")}</span>{staging&&<span className="footer-staging">{shared?tr("STAGING · Shared observation · No real payments","测试环境 · 共享观察 · 无真实支付"):tr("STAGING · Demo only · No real payments","测试环境 · 仅演示 · 无真实支付")}</span>}</div><nav aria-label={tr("Project links","项目链接")}><a href={SITE.x} target="_blank" rel="noopener noreferrer">X / Twitter</a><a href={SITE.github} target="_blank" rel="noopener noreferrer">GitHub</a></nav></footer></div>
      </main>
    </div>
  );
}
