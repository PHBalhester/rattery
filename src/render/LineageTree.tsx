import {tr} from '../i18n';
const coatNames:Record<string,string>={'Solar gold':'太阳金','Sunfire freckles':'火焰斑点','Electric storm':'电光风暴','Jade':'翡翠','Azure':'蔚蓝','Orchid':'兰紫','Rose':'玫瑰','Hooded ivory':'象牙头罩','Cocoa pied':'可可花斑','Silver':'银色','Warm agouti':'暖棕野鼠色','Sable':'深褐色','Legendary':'传说','Rare':'稀有','Uncommon':'少见','Common':'普通'};
import {coatFor} from './ratIdentity';
import { getWorld, useStore } from "../store";
import type { Rat } from "../types";

const VB_W = 320;
const ROW_H = 82;
const TOP = 32;

// Lineage of reproducers: founders, anyone with offspring, plus current adult
// females (candidate mothers). Dead nodes are dimmed. Click focuses the camera.
export default function LineageTree() {
  const version = useStore((s) => s.version);
  const focusedId = useStore((s) => s.focusedId);
  const focus = useStore((s) => s.focus);
  void version;

  const world = getWorld();
  const all = Object.values(world.rats);

  const childrenOf = new Map<string, string[]>();
  for (const r of all) {
    if (r.motherId) {
      const arr = childrenOf.get(r.motherId) ?? [];
      arr.push(r.id);
      childrenOf.set(r.motherId, arr);
    }
  }

  const shown = all.filter(
    (r) =>
      r.gen === 0 ||
      childrenOf.has(r.id) ||
      (r.deadAt === null && r.stage === "adult" && r.sex === "F")
  );

  const maxGen = shown.reduce((m, r) => Math.max(m, r.gen), 0);
  const byGen: Rat[][] = Array.from({ length: maxGen + 1 }, () => []);
  for (const r of shown) byGen[r.gen].push(r);
  byGen.forEach((g) => g.sort((a, b) => a.id.localeCompare(b.id)));

  const treeWidth=Math.max(VB_W,...byGen.map(g=>(g.length+1)*76));
  const pos = new Map<string, { x: number; y: number }>();
  byGen.forEach((gen, g) => {
    gen.forEach((r, i) => {
      pos.set(r.id, { x: ((i + 1) / (gen.length + 1)) * treeWidth, y: TOP + g * ROW_H });
    });
  });

  const height = TOP + (maxGen + 1) * ROW_H;

  return (
    <div className="lineage">
      <div className="panel-head">
        <strong>{tr('Residents','居民')}</strong>
        <span className="dim">{all.filter(r=>r.deadAt===null).length} {tr('alive','存活')}</span>
      </div>
      <div className="production-residents" aria-label={tr('Living rats','存活的大鼠')}>
        {all.filter(r=>r.deadAt===null).map(r=>{const coat=coatFor(r.id,r.coatBucket);return <button key={r.id} aria-pressed={focusedId===r.id} onClick={()=>focus(focusedId===r.id?null:r.id)}>
          <i style={{background:coat.color}}/><span>{r.name}<small>{r.sex==='F'?tr('Female','雌性'):tr('Male','雄性')} · {tr('Gen','世代')} {r.gen} · {tr(coat.name,coatNames[coat.name]??coat.name)}</small></span>
        </button>;})}
      </div>
      {focusedId&&world.rats[focusedId]&&<div className="lineage-legend">{tr(coatFor(focusedId,world.rats[focusedId].coatBucket).rarity,coatNames[coatFor(focusedId,world.rats[focusedId].coatBucket).rarity])} {tr('coat · Age','毛色 · 年龄')} {Math.max(0,(world.rats[focusedId].deadAt??world.simDay)-world.rats[focusedId].bornAt).toFixed(1)} {tr('days','天')}<br/>{tr('Coats are cosmetic variants.','毛色仅为外观差异。')}</div>}
      <details className="readout-details"><summary>{tr('Family tree','家族谱系')}</summary><div className="lineage-scroll">
        <svg viewBox={`0 0 ${treeWidth} ${height}`} width={treeWidth} height={height} style={{minWidth:treeWidth}} role="img" aria-label={tr('Colony family tree','种群家族谱系')}>
          {shown.map((r) =>
            (childrenOf.get(r.id) ?? []).map((cid) => {
              const a = pos.get(r.id);
              const b = pos.get(cid);
              if (!a || !b) return null;
              return (
                <path
                  key={`${r.id}-${cid}`}
                  d={`M ${a.x} ${a.y} C ${a.x} ${(a.y + b.y) / 2}, ${b.x} ${(a.y + b.y) / 2}, ${b.x} ${b.y}`}
                  fill="none"
                  stroke="#3a2c20"
                  strokeWidth={0.8}
                />
              );
            })
          )}
          {shown.map((r) => {
            const p = pos.get(r.id);
            if (!p) return null;
            const dead = r.deadAt !== null;
            const focused = r.id === focusedId;
            const fill = r.sex === "F" ? "#d4574a" : "#6aa7d4";
            return (
              <g
                key={r.id}
                transform={`translate(${p.x} ${p.y})`}
                className="lineage-node"
                tabIndex={0}
                role="button"
                aria-label={`${r.name}, ${r.sex === "F" ? tr('female','雌性') : tr('male','雄性')}, ${tr('generation','世代')} ${r.gen}${dead ? tr(', deceased','，已故') : ""}`}
                aria-pressed={focused}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); focus(focused ? null : r.id); } }}
                onClick={() => focus(focused ? null : r.id)}
              >
                <title>
                  {r.name} · {r.sex} · gen {r.gen}
                  {dead ? ` · ${tr('deceased','已故')}` : r.pregnant ? tr(' · pregnant',' · 怀孕') : ""}
                </title>
                {focused && <circle r={12} fill="none" stroke="#e8c36a" strokeWidth={1.2} />}
                <circle r={r.gen === 0 ? 8 : 6} fill={fill} opacity={dead ? 0.28 : 0.92} />
                {(r.gen === 0 || focused) && (
                  <text y={-15} textAnchor="middle" className="lineage-label">
                    {r.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="lineage-legend"><span className="legend-f">● {tr('Female','雌性')}</span> · <span className="legend-m">● {tr('Male','雄性')}</span><br />{tr('Faded: deceased. Larger: founders.','淡色：已故。较大节点：创始成员。')}</div></details>
    </div>
  );
}
