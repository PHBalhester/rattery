import {tr} from '../i18n';
import { getWorld, useStore } from "../store";
import { stats } from "../sim/tick";

export default function Hud() {
  const version = useStore((s) => s.version);
  const chain = useStore((s) => s.chain);
  void version; // subscribe to re-render each tick
  const s = stats(getWorld());

  const clock = `${tr('Day','第')} ${Math.floor(s.simDay)} · ${String(Math.floor((s.simDay % 1) * 24)).padStart(2, "0")}h`;

  // Chain facts only when we have them. Never show "0 holders" for "unknown".
  const live = !!chain?.launched && chain.ok;
  const holders = live ? chain?.token?.holders : null;
  const launch = live ? chain?.launch : undefined;

  return (
    <div className="hud">
      <Counter label={tr("Alive","存活")} value={s.alive} />
      <Counter label={tr("Pups","幼崽")} value={s.pups} />
      <Counter label={tr("Pregnant","怀孕")} value={s.pregnant} />
      <Counter label={tr("Litters","窝数")} value={s.births} />
      <Counter label={tr("Deaths","死亡")} value={s.deaths} />
      <Counter label={tr("Generation","世代")} value={s.generations} />
      {(holders != null || launch) && <div className="counter-sep" />}
      {holders != null && <Counter label={tr("Holders","持有者")} value={holders} />}
      {launch &&
        (launch.phase === "curve" ? (
          <div className="counter" title={`${launch.quoteRaised?.toFixed(3) ?? "?"} / ${launch.graduationThreshold} ETH`}>
            <span className="counter-value">{Math.round(launch.progress * 100)}%</span>
            <span className="counter-label">{tr('Curve','曲线')}</span>
            <div className="curve-bar">
              <div style={{ width: `${Math.round(launch.progress * 100)}%` }} />
            </div>
          </div>
        ) : (
          <div className="counter">
            <span className="counter-value">v4</span>
            <span className="counter-label">{tr('Graduated','已毕业')}</span>
          </div>
        ))}
      <div className="hud-clock">{clock}</div>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="counter">
      <span className="counter-value">{value}</span>
      <span className="counter-label">{label}</span>
    </div>
  );
}
