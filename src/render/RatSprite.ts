import { Container, Graphics } from "pixi.js";
import type { Rat } from "../types";
import { CONFIG } from "../config";
import { PAL } from "./palette";

// One Pixi container per living rat. The body is redrawn only when its
// appearance key changes (stage / sex / pregnancy / rough energy band);
// position and heading update every frame.
export class RatSprite {
  container: Container;
  private body: Graphics;
  private ring: Graphics;
  private key = "";
  id: string;

  constructor(rat: Rat) {
    this.id = rat.id;
    this.container = new Container();
    this.ring = new Graphics();
    this.body = new Graphics();
    this.container.addChild(this.ring, this.body);
    this.container.x = rat.x;
    this.container.y = rat.y;
  }

  private appearanceKey(rat: Rat, simDay: number, focused: boolean) {
    const eyesOpen = simDay - rat.bornAt >= CONFIG.bio.eyesOpenDay;
    const energyBand = Math.round(rat.energy * 4);
    const preg = rat.pregnant ? 1 : 0;
    return `${rat.stage}|${rat.sex}|${eyesOpen ? 1 : 0}|${preg}|${energyBand}|${focused ? 1 : 0}`;
  }

  private draw(rat: Rat, simDay: number, focused: boolean) {
    const b = this.body;
    b.clear();
    const eyesOpen = simDay - rat.bornAt >= CONFIG.bio.eyesOpenDay;

    if (rat.stage === "neonate" || rat.stage === "juvenile") {
      const juvenile = rat.stage === "juvenile";
      const r = juvenile ? 4 : 2.6;
      b.circle(0, 0, r).fill({ color: PAL.neonate, alpha: 0.95 });
      if (juvenile && eyesOpen) {
        b.circle(r * 0.4, -r * 0.3, 0.9).fill(PAL.eye);
        b.circle(r * 0.4, r * 0.3, 0.9).fill(PAL.eye);
      }
      this.drawRing(focused, r + 3);
      return;
    }

    // adult / weanling body: a capsule with two ears and (if grown) eyes
    const isF = rat.sex === "F";
    let w = 18;
    let h = 10;
    let fur: number = isF ? PAL.furF : PAL.furM;
    if (rat.stage === "weanling") {
      w = 13;
      h = 8;
      fur = PAL.furWeanling;
    } else if (isF) {
      w = 20;
      h = 11;
    }
    const alpha = 0.55 + rat.energy * 0.45;

    // pregnant dam: rounder belly
    const bellyH = rat.pregnant ? h * 1.35 : h;

    b.roundRect(-w / 2, -bellyH / 2, w, bellyH, bellyH / 2).fill({ color: fur, alpha });
    // ears near the head (head = +x)
    const hx = w / 2 - 2;
    b.circle(hx, -h / 2, 2.6).fill({ color: fur, alpha });
    b.circle(hx, h / 2, 2.6).fill({ color: fur, alpha });
    // nose
    b.circle(w / 2 + 1, 0, 1.4).fill({ color: PAL.bloodBright, alpha });
    // eyes
    if (eyesOpen) {
      b.circle(hx - 1, -h * 0.22, 1.1).fill(PAL.eye);
      b.circle(hx - 1, h * 0.22, 1.1).fill(PAL.eye);
    }
    // tail
    b.moveTo(-w / 2, 0)
      .lineTo(-w / 2 - 10, rat.vy > 0 ? 4 : -4)
      .stroke({ width: 1.4, color: fur, alpha: alpha * 0.8 });

    this.drawRing(focused, Math.max(w, bellyH) / 2 + 4);
  }

  private drawRing(focused: boolean, r: number) {
    this.ring.clear();
    if (focused) {
      this.ring.circle(0, 0, r).stroke({ width: 1.5, color: PAL.focus, alpha: 0.9 });
    }
  }

  sync(rat: Rat, simDay: number, focused: boolean) {
    const key = this.appearanceKey(rat, simDay, focused);
    if (key !== this.key) {
      this.key = key;
      this.draw(rat, simDay, focused);
    }
    this.container.x = rat.x;
    this.container.y = rat.y;
    if (rat.stage === "adult" || rat.stage === "weanling") {
      const moving = Math.hypot(rat.vx, rat.vy) > 0.15;
      if (moving) this.container.rotation = Math.atan2(rat.vy, rat.vx);
    }
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
