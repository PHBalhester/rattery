import {tr} from '../i18n';
import { useStore } from "../store";
import { fmtEth } from "../copy/pons";
import type { FeedStatus } from "../market/types";

function short(w: string) {
  if (!w || w.length < 10) return w;
  return `${w.slice(0, 5)}..${w.slice(-3)}`;
}

const statusText=():Record<FeedStatus,string> => ({
  idle: tr("Starting","启动中"),
  demo: tr("Simulated trades","模拟交易"),
  connecting: tr("Connecting to Robinhood Chain","正在连接Robinhood Chain"),
  catchup: tr("Replaying history","重建历史"),
  live: tr("Live · Robinhood Chain","实时 · Robinhood Chain"),
  error: tr("Disconnected · retrying","连接中断 · 重试中"),
  "history-limit": tr("History limit · simulation paused","历史限制 · 模拟已暂停"),
});

export default function TradeTape() {
  const trades = useStore((s) => s.trades);
  const status = useStore((s) => s.feedStatus);

  return (
    <div className="tape">
      <div className="tape-status">
        <span className={`dot dot-${status}`} />
        <span className="dim">{statusText()[status]}</span>
        <span className="tape-legend"><b className="buy">▲ {tr('Buy','买入')}</b> {tr('feeds','补给')} <b className="sell">▼ {tr('Sell','卖出')}</b> {tr('stresses','施压')}</span>
      </div>
      <div className="tape-scroll">
        {trades.length === 0 && status !== "history-limit" && <span className="dim tape-empty">{tr('Waiting for the first trade…','等待第一笔交易…')}</span>}
        {trades.map((t) => (
          <span
            key={t.id}
            className={`tape-item ${t.side}${t.backlog ? " backlog" : ""}`}
            title={t.backlog ? "before you arrived: shown, not fed to the nest" : undefined}
          >
            <b>{t.side === "buy" ? tr('Buy','买入') : tr('Sell','卖出')}</b> {fmtEth(t.eth)} ETH
            <span className="dim"> {short(t.trader)}</span>
            {t.venue !== "demo" && <span className="tape-venue">{t.venue}</span>}
            {t.isNewHolder && !t.backlog && <span className="new-holder"> {tr('+holder','+持有者')}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
