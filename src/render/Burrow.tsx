import { useEffect, useRef } from "react";
import { Application, Container, Graphics } from "pixi.js";
import { CONFIG } from "../config";
import { getWorld, useStore } from "../store";
import { buildBurrowScenery, NEST_CENTER } from "./Nest";
import { RatSprite } from "./RatSprite";
import { PAL } from "./palette";

const W = CONFIG.colony.burrowWidth;
const H = CONFIG.colony.burrowHeight;

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
}

export default function Burrow() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let app: Application | null = null;
    let cleanupTicker: (() => void) | null = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    (async () => {
      const a = new Application();
      await a.init({
        background: PAL.earth,
        resizeTo: host,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      });
      if (cancelled) {
        a.destroy(true, { children: true });
        return;
      }
      app = a;
      host.appendChild(a.canvas);

      const camera = new Container(); // world-space, we pan/zoom this
      camera.addChild(buildBurrowScenery());
      const ratLayer = new Container();
      const fxLayer = new Container();
      camera.addChild(ratLayer, fxLayer);
      a.stage.addChild(camera);

      const sprites = new Map<string, RatSprite>();
      const particles: Particle[] = [];
      let lastBirthKey = "";

      // camera state (lerped toward target each frame)
      let camScale = fitScale(a);
      let camX = 0;
      let camY = 0;

      // click to focus nearest rat
      a.stage.eventMode = "static";
      a.stage.hitArea = a.screen;
      a.stage.on("pointertap", (e) => {
        const s = camera.scale.x || 1;
        const wx = (e.global.x - camera.x) / s;
        const wy = (e.global.y - camera.y) / s;
        const world = getWorld();
        let bestId: string | null = null;
        let bestD = 40;
        for (const r of Object.values(world.rats)) {
          if (r.deadAt !== null) continue;
          const d = Math.hypot(r.x - wx, r.y - wy);
          if (d < bestD) {
            bestD = d;
            bestId = r.id;
          }
        }
        useStore.getState().focus(bestId);
      });

      const tickFn = () => {
        const world = getWorld();
        const simDay = world.simDay;
        const focusedId = useStore.getState().focusedId;
        const seen = new Set<string>();

        // sync sprites
        for (const r of Object.values(world.rats)) {
          if (r.deadAt !== null) continue;
          seen.add(r.id);
          let sp = sprites.get(r.id);
          if (!sp) {
            sp = new RatSprite(r);
            sprites.set(r.id, sp);
            ratLayer.addChild(sp.container);
          }
          sp.sync(r, simDay, r.id === focusedId);
        }
        // remove sprites for dead/gone rats
        for (const [id, sp] of sprites) {
          if (!seen.has(id)) {
            sp.destroy();
            sprites.delete(id);
          }
        }

        // birth particles: fire when the most recent delivery changes
        const lb = world.lastBirth;
        if (lb) {
          const key = `${lb.t}:${lb.ratId}`;
          if (key !== lastBirthKey) {
            lastBirthKey = key;
            const dam = world.rats[lb.ratId];
            if (dam && !reducedMotion.matches) spawnBirthBurst(fxLayer, particles, dam.x, dam.y);
          }
        }

        // advance particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.life -= 0.016;
          p.g.x += p.vx;
          p.g.y += p.vy;
          p.g.alpha = Math.max(0, p.life);
          if (p.life <= 0) {
            p.g.destroy();
            particles.splice(i, 1);
          }
        }

        // camera: fit-all, or zoom+center on the focused rat
        let targetScale = fitScale(a);
        let targetCx = a.screen.width / 2 - (W / 2) * targetScale;
        let targetCy = a.screen.height / 2 - (H / 2) * targetScale;
        if (focusedId && world.rats[focusedId] && world.rats[focusedId].deadAt === null) {
          const f = world.rats[focusedId];
          targetScale = fitScale(a) * 1.9;
          targetCx = a.screen.width / 2 - f.x * targetScale;
          targetCy = a.screen.height / 2 - f.y * targetScale;
        }
        const easing = reducedMotion.matches ? 1 : 0.08;
        camScale += (targetScale - camScale) * easing;
        camX += (targetCx - camX) * easing;
        camY += (targetCy - camY) * easing;
        camera.scale.set(camScale);
        camera.x = camX;
        camera.y = camY;
      };

      a.ticker.add(tickFn);
      cleanupTicker = () => a.ticker.remove(tickFn);
    })();

    return () => {
      cancelled = true;
      cleanupTicker?.();
      if (app) {
        app.destroy(true, { children: true });
        app = null;
      }
    };
  }, []);

  return <div ref={hostRef} className="burrow-host" />;
}

function fitScale(a: Application) {
  return Math.min(a.screen.width / W, a.screen.height / H) * 0.98;
}

function spawnBirthBurst(layer: Container, particles: Particle[], x: number, y: number) {
  for (let i = 0; i < 26; i++) {
    const g = new Graphics();
    g.circle(0, 0, 1.6 + Math.random() * 1.6).fill({ color: PAL.milk, alpha: 1 });
    g.x = x;
    g.y = y;
    layer.addChild(g);
    const ang = Math.random() * Math.PI * 2;
    const spd = 0.6 + Math.random() * 2.2;
    particles.push({
      g,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: 0.7 + Math.random() * 0.9,
    });
  }
}

export { NEST_CENTER };
