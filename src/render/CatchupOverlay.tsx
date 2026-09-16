import {tr} from '../i18n';
import { useStore } from '../store';

export default function CatchupOverlay() {
  const status = useStore(s => s.feedStatus);
  const raw = useStore(s => s.catchupPct);
  const pct = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
  if (status !== 'catchup') return null;
  return (
    <div className="colony-catchup">
      <div className="colony-catchup-copy">
        <span role="status">{tr('Replaying the colony','正在重建种群')}</span>
        <span className="colony-catchup-pct" aria-hidden="true">{Math.floor(pct)}%</span>
      </div>
      <div className="colony-catchup-track" role="progressbar" aria-label={tr('Replaying colony history','重建种群历史')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(pct)}>
        <div style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <span className="colony-catchup-note">{tr('Replaying colony history','重建种群历史')}</span>
    </div>
  );
}
