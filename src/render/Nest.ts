import { Container, Graphics } from "pixi.js";
import { CONFIG } from "../config";
import { NEST_POS } from "../sim/colony";
import { PAL } from "./palette";

// Static burrow scenery: dark earth, a few bezier galleries, and the straw
// nest circle at center-bottom. Drawn once into its own container.
export function buildBurrowScenery(): Container {
  const W = CONFIG.colony.burrowWidth;
  const H = CONFIG.colony.burrowHeight;
  const layer = new Container();

  const floor = new Graphics();
  floor.rect(0, 0, W, H).fill(PAL.earth);
  layer.addChild(floor);

  // galleries: soft brown tunnels radiating from the nest
  const galleries = new Graphics();
  const nx = NEST_POS.x;
  const ny = NEST_POS.y;
  const tunnels: [number, number, number, number, number, number][] = [
    [nx, ny, nx - 380, ny - 260, 120, 120],
    [nx, ny, nx + 420, ny - 300, 180, 90],
    [nx, ny, nx - 520, ny + 120, 260, 260],
    [nx, ny, nx + 560, ny + 60, 300, 220],
    [nx, ny, nx + 120, ny - 420, 60, 60],
  ];
  for (const [x0, y0, x1, y1, cx, cy] of tunnels) {
    galleries
      .moveTo(x0, y0)
      .quadraticCurveTo(cx + (x0 + x1) / 2 - x0, cy + (y0 + y1) / 2 - y0, x1, y1)
      .stroke({ width: 46, color: PAL.gallery, alpha: 1, cap: "round" });
    galleries
      .moveTo(x0, y0)
      .quadraticCurveTo(cx + (x0 + x1) / 2 - x0, cy + (y0 + y1) / 2 - y0, x1, y1)
      .stroke({ width: 46, color: PAL.galleryEdge, alpha: 0.25, cap: "round" });
  }
  layer.addChild(galleries);

  // nest: straw ring
  const nest = new Graphics();
  nest.circle(nx, ny, NEST_POS.r + 10).fill({ color: PAL.strawDark, alpha: 0.9 });
  nest.circle(nx, ny, NEST_POS.r).fill({ color: PAL.straw, alpha: 0.35 });
  // straw strokes
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const r0 = NEST_POS.r * 0.5;
    const r1 = NEST_POS.r * 1.02;
    nest
      .moveTo(nx + Math.cos(a) * r0, ny + Math.sin(a) * r0)
      .lineTo(nx + Math.cos(a + 0.4) * r1, ny + Math.sin(a + 0.4) * r1)
      .stroke({ width: 1.5, color: PAL.straw, alpha: 0.5 });
  }
  layer.addChild(nest);

  return layer;
}

export const NEST_CENTER = NEST_POS;
