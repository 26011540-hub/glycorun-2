import { item } from "../content/items";
import { MSG } from "../content/texts";
import * as K from "./constants";
import { dose, TARGET_HIGH, TARGET_LOW } from "./glucose";
import { toast, type CollectEffect, type GameState, type ObstacleType, type WorldObject } from "./state";

const addG = (s: GameState, total: number, dur: number) => s.doses.push(dose(total, dur));
const cond = (s: GameState, d: number) => { s.cond = Math.max(0, Math.min(100, s.cond + d)); };

/** Efeito de pegar um item (regras do original). */
export function collect(s: GameState, o: WorldObject): void {
  const it = item(o.type);
  const g = s.g;
  const reduced = s.boost > 0 || s.turbo > 0; // exercício recente reduz o pico pela metade
  const f = reduced ? 0.5 : 1;
  let effect: CollectEffect = "good";

  switch (it.k) {
    case "good":
      addG(s, 7 * f, 3);
      cond(s, 3);
      s.score += 50;
      if (g < TARGET_LOW) { addG(s, 10, 2); toast(s, MSG.goodLow(it.n), 2.4); }
      else toast(s, MSG.good(it.n), 1.5);
      break;
    case "water":
      effect = "water";
      s.score += 30;
      toast(s, MSG.water, 1.4);
      break;
    case "ex":
      effect = "ex";
      addG(s, -22, 4);
      s.boost = 7;
      s.exGot++;
      cond(s, 9);
      s.score += 80;
      toast(s, MSG.exercise, 2);
      break;
    case "med":
      effect = "med";
      addG(s, -28, 4);
      s.score += 40;
      toast(s, g < 100 ? MSG.medLow : MSG.med, 2.4);
      break;
    case "bad":
      if (g < TARGET_LOW && it.fast) {
        effect = "fix";
        addG(s, 38, 2);
        s.score += 60;
        toast(s, MSG.fix, 2.6);
      } else if (s.insShield) {
        effect = "insulin";
        s.insShield = false;
        addG(s, 9 * f, 2);
        toast(s, MSG.insulinShield, 2.6);
      } else {
        effect = "bad";
        addG(s, (it.mild ? 28 : 42) * f, 1.4);
        cond(s, -6);
        s.score = Math.max(0, s.score - 20);
        toast(s, MSG.bad(it.n, f < 1), 1.6);
      }
      if (o.thrown && s.boss) s.boss.hits++;
      break;
    case "veg":
    case "prot":
    case "carb":
      effect = "plate";
      if (s.plate) s.plate[it.k]++;
      s.score += 40;
      addG(s, it.k === "carb" ? 8 : it.k === "veg" ? 3 : 1, 3);
      cond(s, 2);
      break;
    case "pw":
      effect = "power";
      s.score += 100;
      if (o.type === "ima") { s.magnet = 10; toast(s, MSG.ima, 2.8); }
      if (o.type === "tenis") { s.turbo = 10; s.boost = Math.max(s.boost, 10); toast(s, MSG.tenis, 2.8); }
      if (o.type === "escudo") { s.insShield = true; toast(s, MSG.escudo, 2.6); }
      if (o.type === "aguaT") {
        if (g > TARGET_HIGH) { addG(s, -(g - TARGET_HIGH) * 0.45 - 12, 3); toast(s, MSG.aguaTHigh, 3.4); }
        else toast(s, MSG.aguaT, 2.2);
      }
      break;
  }
  s.events.push({ type: "collect", obj: o, effect });
}

/** Bater num obstáculo. */
export function hitObstacle(s: GameState, type: ObstacleType): void {
  if (s.inv > 0) return;
  if (s.shield > 0) {
    s.shield = 0;
    s.inv = 1;
    s.events.push({ type: "shieldBlock" });
    toast(s, MSG.quizShield, 1.6);
    return;
  }
  s.lives--;
  s.inv = K.HIT_INVULNERABLE;
  cond(s, -4);
  s.events.push({ type: "hit", obstacle: type, livesLeft: s.lives });
  toast(s, MSG.hit[type], 2.2);
  if (s.lives <= 0) endGame(s, MSG.overObstacles);
}

export function endGame(s: GameState, reason: string): void {
  if (s.over) return;
  s.over = true;
  s.overReason = reason;
  s.events.push({ type: "gameOver", reason });
}
