import { BOSS_THROWS, item, PLATE_LANES, POOL, POWERUPS } from "../content/items";
import { MSG } from "../content/texts";
import { collect, endGame, hitObstacle } from "./collect";
import * as K from "./constants";
import { G_MAX, G_MIN, TARGET_HIGH, TARGET_LOW, zoneOf } from "./glucose";
import { pick, type Rng } from "./rng";
import { meters, toast, type Action, type GameState, type ObstacleType, type WorldObject } from "./state";

const LANES = [-1, 0, 1] as const;
const TIMERS = ["inv", "shield", "mult", "boost", "magnet", "turbo"] as const;
const POOL_SUM = POOL.reduce((a, [, w]) => a + w, 0);

/** Comando do jogador (deslizar ou tecla). */
export function act(s: GameState, a: Action): void {
  if (s.over) return;
  if (a === "L" || a === "R") {
    const dir = a === "L" ? -1 : 1;
    const next = Math.max(-1, Math.min(1, s.lane + dir)) as -1 | 0 | 1;
    if (next !== s.lane) {
      s.lane = next;
      s.events.push({ type: "lane", dir });
    }
  } else if (a === "U") {
    s.slide = 0;
    const maxJumps = s.turbo > 0 ? 2 : 1;
    if (s.y <= 0.01) s.jumps = 0;
    if (s.jumps < maxJumps) {
      s.vy = s.turbo > 0 ? K.JUMP_V_TURBO[s.jumps ? 1 : 0] : K.JUMP_V;
      s.events.push({ type: "jump", double: s.jumps > 0 });
      s.jumps++;
      s.jumpBuf = 0;
    } else {
      s.jumpBuf = K.JUMP_BUFFER;
    }
  } else if (a === "D") {
    if (s.y > 0.01) s.vy = K.DIVE_V;
    s.slide = K.SLIDE_TIME;
    s.events.push({ type: "slide" });
  }
}

/** O obstáculo foi ultrapassado sem bater? */
export function clears(s: GameState, type: ObstacleType): boolean {
  if (type === "sofa") return s.y > K.CLEAR_SOFA_Y;
  if (type === "tela") return s.slide > 0;
  return s.y > K.CLEAR_PILHA_Y;
}

function pickItem(rng: Rng): string {
  let r = rng() * POOL_SUM;
  for (const [k, w] of POOL) if ((r -= w) < 0) return k;
  return "maca";
}

function addObj(s: GameState, kind: "obs" | "item", type: string, lx: number, extra?: Partial<WorldObject>): void {
  s.objs.push({ id: s.nextId++, kind, type, lx, z: K.SPAWN_Z, y0: 0, done: false, ...extra });
}

function spawnRow(s: GameState, rng: Rng): void {
  if (s.plate) {
    // Desafio do Prato: cada faixa tem um grupo fixo
    LANES.forEach((l, i) => addObj(s, "item", pick(rng, PLATE_LANES[i]), l));
    return;
  }
  let obsLane: number | null = null;
  if (s.t > K.OBSTACLE_START_T && !s.boss && rng() < K.OBSTACLE_CHANCE) {
    obsLane = pick(rng, LANES);
    const r = rng();
    addObj(s, "obs", r < 0.42 ? "sofa" : r < 0.75 ? "tela" : "pilha", obsLane);
  }
  let powerPlaced = false;
  for (const l of LANES) {
    if (l === obsLane) continue;
    if (!powerPlaced && s.nextPower <= 0) {
      addObj(s, "item", pick(rng, POWERUPS), l);
      powerPlaced = true;
      s.nextPower = 13 + rng() * 8;
      continue;
    }
    if (rng() < K.ITEM_CHANCE) addObj(s, "item", pickItem(rng), l);
  }
}

function startBoss(s: GameState): void {
  const type = s.bossCount % 2 ? "burger" : "lata";
  s.boss = { t: 0, lx: 0, throwT: 1.2, hits: 0, type };
  s.bossCount++;
  s.events.push({ type: "bossStart", boss: type });
  toast(s, MSG.bossStart, 2.6);
}

function updateBoss(s: GameState, dt: number, rng: Rng): void {
  const B = s.boss!;
  B.t += dt;
  B.lx = Math.sin(B.t * 1.7) * 1.05;
  if (B.t > 1.5 && B.t < K.BOSS_DUR - 1.5) {
    B.throwT -= dt;
    if (B.throwT <= 0) {
      B.throwT = Math.max(0.42, 0.75 - s.speed * 0.006);
      const lane = Math.max(-1, Math.min(1, Math.round(B.lx)));
      s.objs.push({ id: s.nextId++, kind: "item", type: pick(rng, BOSS_THROWS), lx: lane, z: 29, y0: 4, done: false, thrown: true });
    }
  }
  if (B.t >= K.BOSS_DUR) {
    const win = B.hits === 0;
    if (win) { s.score += K.BOSS_WIN_BONUS; toast(s, MSG.bossWin, 2.6); }
    else toast(s, MSG.bossLose, 2.2);
    s.boss = null;
    s.events.push({ type: "bossEnd", win });
  }
}

function endPlate(s: GameState): void {
  const p = s.plate!;
  s.plate = null;
  const n = p.veg + p.prot + p.carb;
  let win = false;
  if (n < 4) toast(s, MSG.plateFew, 3.4);
  else {
    const v = p.veg / n, pr = p.prot / n, c = p.carb / n;
    if (v >= 0.4 && pr >= 0.15 && pr <= 0.4 && c >= 0.15 && c <= 0.4) {
      win = true;
      s.score += K.PLATE_BONUS;
      s.cond = Math.min(100, s.cond + 8);
      toast(s, MSG.plateWin, 3.2);
    } else toast(s, v < 0.4 ? MSG.plateNoVeg : c > 0.4 ? MSG.plateCarb : MSG.plateBalance, 3.2);
  }
  s.events.push({ type: "plateEnd", win });
}

/** Avança a simulação. Passos grandes são divididos para nenhuma colisão "atravessar" um objeto. */
export function step(s: GameState, dt: number, rng: Rng): void {
  let left = Math.min(dt, 0.1);
  while (left > 1e-6 && !s.over && !s.quizDue) {
    const h = Math.min(left, 1 / 60);
    tick(s, h, rng);
    left -= h;
  }
}

function tick(s: GameState, dt: number, rng: Rng): void {
  s.t += dt;
  const day = Math.floor(s.t / K.DAY_CYCLE) + 1;
  if (day !== s.day) {
    s.day = day;
    s.events.push({ type: "day", day });
    toast(s, MSG.day(day), 2.4);
  }

  // chuva
  if (s.t > s.nextRain && !s.rainOn) {
    s.rainOn = true;
    s.rainEnd = s.t + 14 + rng() * 6;
    s.events.push({ type: "rain", on: true });
    toast(s, MSG.rain, 2);
  }
  if (s.rainOn && s.t > s.rainEnd) {
    s.rainOn = false;
    s.nextRain = s.t + 40 + rng() * 30;
    s.events.push({ type: "rain", on: false });
  }
  s.rain += ((s.rainOn ? 1 : 0) - s.rain) * Math.min(1, dt * 0.8);

  // velocidade: hipoglicemia deixa mais lento, hiperglicemia cansa
  const gain = s.touch ? K.SPEED_GAIN.touch : K.SPEED_GAIN.keyboard;
  s.speed = K.START_SPEED + Math.min(gain.max, s.t * gain.rate);
  const slow = s.g < TARGET_LOW ? K.SLOW_HYPO : s.g > TARGET_HIGH ? K.SLOW_HYPER : 1;
  s.runSpeed = s.speed * slow;
  const move = s.runSpeed * dt;
  s.dist += move;

  // jogador
  s.px += (s.lane - s.px) * Math.min(1, dt * (s.g < TARGET_LOW ? K.LANE_SPEED_HYPO : K.LANE_SPEED));
  const wasAir = s.y > 0;
  s.vy -= K.GRAVITY * dt;
  s.y = Math.max(0, s.y + s.vy * dt);
  if (s.y === 0 && s.vy < 0) {
    s.vy = 0;
    s.jumps = 0;
    if (wasAir) s.events.push({ type: "land" });
  }
  if (s.jumpBuf > 0) {
    s.jumpBuf -= dt;
    if (s.y <= 0.01 && s.jumpBuf > 0) act(s, "U");
  }
  s.slide = Math.max(0, s.slide - dt);
  for (const k of TIMERS) s[k] = Math.max(0, s[k] - dt);

  // glicemia
  let dg = -(K.G_DECAY + (s.boost > 0 ? K.G_DECAY_BOOST : 0)) * dt;
  if (s.turbo > 0 && s.g > K.TENIS_ABOVE) dg -= K.G_TENIS_EXTRA * dt;
  let n = 0;
  for (const d of s.doses) {
    const used = Math.min(dt, d.left);
    dg += d.rate * used;
    d.left -= used;
    if (d.left > 0) s.doses[n++] = d;
  }
  s.doses.length = n;
  s.g = Math.max(G_MIN, Math.min(G_MAX, s.g + dg));
  const z = zoneOf(s.g);
  s.totT += dt;
  if (z === "g") s.tirT += dt;
  if (z === "r") {
    s.redT += dt;
    if (s.redT > K.RED_LIMIT) {
      const low = s.g < TARGET_LOW;
      s.lives--;
      s.redT = 0;
      s.doses = [];
      s.g = low ? K.RESET_LOW : K.RESET_HIGH;
      s.inv = 1.2;
      s.events.push({ type: "glucoseLife", low, livesLeft: s.lives });
      toast(s, low ? MSG.severeLow : MSG.severeHigh, 3.2);
      if (s.lives <= 0) return endGame(s, low ? MSG.overLow : MSG.overHigh);
    }
  } else s.redT = Math.max(0, s.redT - dt * 2);
  if (s.g < TARGET_LOW && !s.hypoWarned) { s.hypoWarned = true; toast(s, MSG.warnLow, 3); }
  if (s.g >= TARGET_LOW + 10) s.hypoWarned = false;
  if (s.g > TARGET_HIGH && !s.hyperWarned) { s.hyperWarned = true; toast(s, MSG.warnHigh, 2.8); }
  if (s.g < TARGET_HIGH - 10) s.hyperWarned = false;

  // pontos: verde ×2, amarelo ×0,5, vermelho 0; acerto no quiz dobra
  s.score += dt * s.runSpeed * (z === "g" ? 2 : z === "y" ? 0.5 : 0) * (s.mult > 0 ? 2 : 1) * 0.3;

  // chefão a cada 500 m; Desafio do Prato periódico
  if (!s.boss && !s.plate && Math.floor(meters(s) / K.BOSS_EVERY_M) > s.bossCount) startBoss(s);
  if (s.boss) updateBoss(s, dt, rng);
  s.nextPlate -= dt;
  if (!s.plate && !s.boss && s.nextPlate <= 0) {
    s.plate = { t: 0, veg: 0, prot: 0, carb: 0 };
    s.nextPlate = K.PLATE_EVERY;
    s.events.push({ type: "plateStart" });
    toast(s, MSG.plateStart, 3.6);
  }
  if (s.plate) {
    s.plate.t += dt;
    if (s.plate.t > K.PLATE_DUR) endPlate(s);
  }

  // objetos
  for (const o of s.objs) {
    o.z -= move;
    if (o.thrown && o.y0 > 0) o.y0 = Math.max(0, o.y0 - dt * 5);
    if (s.magnet > 0 && o.kind === "item" && !o.done && item(o.type).fiber && o.z < 32 && o.z > -0.5) {
      o.lx += (s.px - o.lx) * Math.min(1, dt * 7);
      o.magnet = true;
    }
  }
  s.nextRow -= move;
  if (s.nextRow <= 0) {
    spawnRow(s, rng);
    s.nextRow = s.plate ? Math.max(7, s.speed * 0.42) : Math.max(9, s.speed * 0.6);
  }
  s.nextPower -= dt;

  // colisões
  for (const o of s.objs) {
    if (o.done) continue;
    if (o.kind === "item" && item(o.type).k === "ex" && o.z < -0.6 && !o.counted) { o.counted = true; s.exMiss++; }
    if (Math.abs(o.z) > K.HIT_Z || Math.abs(o.lx - s.px) > K.HIT_LANE) continue;
    if (o.kind === "item") {
      o.done = true;
      collect(s, o);
    } else if (!clears(s, o.type as ObstacleType)) {
      o.done = true;
      hitObstacle(s, o.type as ObstacleType);
    }
    if (s.over) return;
  }
  // remove itens pegos e o que ficou para trás, sem criar lista nova
  let w = 0;
  for (const o of s.objs) if (o.z > K.DESPAWN_Z && !(o.done && o.kind === "item")) s.objs[w++] = o;
  s.objs.length = w;

  // quiz a cada 30 s (espera o Desafio do Prato terminar)
  s.quizT -= dt;
  if (s.quizT <= 0 && !s.plate && !s.quizDue) {
    s.quizDue = true;
    s.events.push({ type: "quiz" });
  }
}

