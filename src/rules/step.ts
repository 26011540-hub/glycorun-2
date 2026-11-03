import * as K from "./constants";
import { pick, type Rng } from "./rng";
import type { Action, GameState, ObstacleType, WorldObject } from "./state";

const LANES = [-1, 0, 1] as const;

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

function spawnRow(s: GameState, rng: Rng): void {
  let obsLane: number | null = null;
  if (s.t > K.OBSTACLE_START_T && rng() < K.OBSTACLE_CHANCE) {
    obsLane = pick(rng, LANES);
    const r = rng();
    const type: ObstacleType = r < 0.42 ? "sofa" : r < 0.75 ? "tela" : "pilha";
    s.objs.push({ id: s.nextId++, kind: "obs", type, lx: obsLane, z: K.SPAWN_Z, done: false });
  }
  for (const l of LANES) {
    if (l === obsLane) continue;
    if (rng() < K.ITEM_CHANCE) s.objs.push({ id: s.nextId++, kind: "item", type: "orb", lx: l, z: K.SPAWN_Z, done: false });
  }
}

function hit(s: GameState, o: WorldObject): void {
  if (s.inv > 0) return;
  s.lives--;
  s.inv = K.HIT_INVULNERABLE;
  s.events.push({ type: "hit", obstacle: o.type as ObstacleType, livesLeft: s.lives });
  if (s.lives <= 0) {
    s.over = true;
    s.events.push({ type: "gameOver" });
  }
}

/** Avança a simulação. Passos grandes são divididos para nenhuma colisão "atravessar" um objeto. */
export function step(s: GameState, dt: number, rng: Rng): void {
  let left = Math.min(dt, 0.1);
  while (left > 1e-6 && !s.over) {
    const h = Math.min(left, 1 / 60);
    tick(s, h, rng);
    left -= h;
  }
}

function tick(s: GameState, dt: number, rng: Rng): void {
  s.t += dt;
  const gain = s.touch ? K.SPEED_GAIN.touch : K.SPEED_GAIN.keyboard;
  s.speed = K.START_SPEED + Math.min(gain.max, s.t * gain.rate);
  const move = s.speed * dt;
  s.dist += move;

  // jogador
  s.px += (s.lane - s.px) * Math.min(1, dt * K.LANE_SPEED);
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
  s.inv = Math.max(0, s.inv - dt);
  s.turbo = Math.max(0, s.turbo - dt);

  // mundo
  for (const o of s.objs) o.z -= move;
  s.nextRow -= move;
  if (s.nextRow <= 0) {
    spawnRow(s, rng);
    s.nextRow = Math.max(9, s.speed * 0.6);
  }

  // colisões
  for (const o of s.objs) {
    if (o.done || Math.abs(o.z) > K.HIT_Z || Math.abs(o.lx - s.px) > K.HIT_LANE) continue;
    if (o.kind === "item") {
      o.done = true;
      s.score += 50;
      s.events.push({ type: "collect", obj: o });
    } else if (!clears(s, o.type as ObstacleType)) {
      o.done = true;
      hit(s, o);
    }
  }
  s.objs = s.objs.filter((o) => o.z > K.DESPAWN_Z && !(o.done && o.kind === "item"));
  s.score += dt * s.speed * 0.3;
}
