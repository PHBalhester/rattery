import Brain3D from "./Brain3D";
import { CONFIG } from "../config";
import { getWorld, useStore } from "../store";
import { brainActivation } from "../sim/brain";
import type { Rat } from "../types";

export default function BrainOverlay() {

  // re-render at tick cadence
  const version = useStore((s) => s.version);
  void version;

  const world = getWorld();
  const focusedId=useStore(s=>s.focusedId);
  const motherId = focusedId ?? world.lastBirth?.ratId ?? null;
  const mother: Rat | undefined = motherId ? world.rats[motherId] : undefined;

  const givingBirth =
    !!mother &&
    mother.lastBirthAt !== null &&
    world.simDay - mother.lastBirthAt < 0.2;

  const h = mother?.hormones;
  const act = brainActivation({
    cort: h?.cort ?? 0.2,
    ot: h?.ot ?? 0.05,
    prl: h?.prl ?? 0.1,
    da: h?.da ?? 0.1,
    e2: h?.e2 ?? 0.15,
    givingBirth,
    retrieving: !!mother?.retrieving,
    food: world.env.food,
  });

  return (
    <div className="brain">
      <div className="panel-head">
        <span>{focusedId?'selected rat brain':'mother brain'}</span>
        <span className="dim">{mother ? mother.name : "no dam yet"}</span>
      </div>

      <Brain3D activity={act} />
      {!mother && <p className="brain-note">Awaiting the first litter. Graph shows baseline activity; hormone readings begin after a birth.</p>}

      <p className="brain-note">Illustrative structure and cosmetic pulses. Readings are model indices.</p>
      <div className="bars">
        <HormoneBar label="cort" v={h?.cort ?? 0} color="var(--blood)" />
        <HormoneBar label="OT" v={h?.ot ?? 0} color="var(--milk)" />
        <HormoneBar label="PRL" v={h?.prl ?? 0} color="#e8c36a" />
        <HormoneBar label="E2" v={h?.e2 ?? 0} color="#c9844a" />
        <HormoneBar label="P4" v={h?.p4 ?? 0} color="#9a6bb5" />
        <HormoneBar label="DA" v={h?.da ?? 0} color="#6aa7d4" />
      </div>

      <div className="panel-head">
        <span>colony climate</span>
        <span className="dim">1 day = {CONFIG.time.realMsPerSimDay / 1000}s</span>
      </div>
      <div className="bars">
        <HormoneBar label="food" v={world.env.food} color="#7c9a6e" />
        <HormoneBar label="warmth" v={world.env.warmth} color="#c9844a" />
        <HormoneBar label="stress" v={world.env.stress} color="var(--blood-deep)" />
      </div>
    </div>
  );
}

function HormoneBar({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.max(0, Math.min(1, v)) * 100)}>
        <div className="bar-fill" style={{ width: `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`, background: color }} />
      </div>
      <span className="bar-value">{Math.round(Math.max(0, Math.min(1, v)) * 100)}</span>
    </div>
  );
}

