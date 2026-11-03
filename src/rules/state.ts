import * as K from "./constants";
import { G_START, type Dose } from "./glucose";

export type Action = "L" | "R" | "U" | "D";
export type ObstacleType = "sofa" | "tela" | "pilha";

export interface WorldObject {
  id: number;
  kind: "obs" | "item";
  type: string; // tipo do obstáculo ou id do item (ver content/items.ts)
  lx: number; // posição lateral em faixas (-1, 0, 1; o ímã pode puxar para valores intermediários)
  z: number; // distância à frente do jogador
  y0: number; // altura extra (itens lançados pelo chefão caem até o chão)
  done: boolean;
  thrown?: boolean;
  magnet?: boolean; // sendo puxado pelo ímã
  counted?: boolean; // exercício perdido já contado
}

export interface Boss {
  t: number;
  lx: number;
  throwT: number;
  hits: number;
  type: "lata" | "burger";
}

export interface Plate {
  t: number;
  veg: number;
  prot: number;
  carb: number;
}

export type CollectEffect = "good" | "water" | "ex" | "med" | "bad" | "fix" | "insulin" | "plate" | "power";

/** Acontecimentos de um quadro, para a renderização, o som e a interface reagirem. */
export type GameEvent =
  | { type: "jump"; double: boolean }
  | { type: "land" }
  | { type: "slide" }
  | { type: "lane"; dir: -1 | 1 }
  | { type: "hit"; obstacle: ObstacleType; livesLeft: number }
  | { type: "shieldBlock" }
  | { type: "collect"; obj: WorldObject; effect: CollectEffect }
  | { type: "toast"; text: string; sec: number }
  | { type: "glucoseLife"; low: boolean; livesLeft: number }
  | { type: "bossStart"; boss: Boss["type"] }
  | { type: "bossEnd"; win: boolean }
  | { type: "plateStart" }
  | { type: "plateEnd"; win: boolean }
  | { type: "day"; day: number }
  | { type: "rain"; on: boolean }
  | { type: "quiz" }
  | { type: "quizEnd"; ok: boolean }
  | { type: "gameOver"; reason: string };

export interface GameState {
  t: number; // segundos de corrida
  dist: number; // unidades percorridas
  speed: number; // velocidade base (sem a lentidão da hipo/hiper)
  runSpeed: number; // velocidade real deste quadro
  touch: boolean; // celular: aceleração mais suave
  // jogador
  lane: -1 | 0 | 1;
  px: number; // posição lateral suavizada
  y: number;
  vy: number;
  jumps: number;
  jumpBuf: number;
  slide: number;
  lives: number;
  inv: number; // invencível após batida
  score: number;
  // glicemia e corpo
  g: number;
  doses: Dose[];
  cond: number; // condicionamento 0–100
  redT: number; // tempo acumulado no vermelho
  tirT: number; // tempo na faixa-alvo
  totT: number;
  hypoWarned: boolean;
  hyperWarned: boolean;
  // efeitos temporários (segundos restantes)
  shield: number; // escudo do quiz contra obstáculos
  mult: number; // pontos ×2 extra do quiz
  boost: number; // exercício: glicose cai mais rápido, picos menores
  magnet: number;
  turbo: number; // Tênis do Boost: pulo duplo
  insShield: boolean; // Escudo de Insulina pronto
  // estatísticas
  exGot: number;
  exMiss: number;
  qOk: number;
  qTot: number;
  // eventos e ambiente
  quizT: number;
  quizDue: boolean;
  boss: Boss | null;
  bossCount: number;
  plate: Plate | null;
  nextPlate: number;
  nextPower: number;
  day: number;
  rain: number; // 0–1 suavizado
  rainOn: boolean;
  nextRain: number;
  rainEnd: number;
  // mundo
  objs: WorldObject[];
  nextRow: number;
  nextId: number;
  over: boolean;
  overReason: string;
  events: GameEvent[];
}

export function createGame(touch: boolean, rng: () => number = Math.random): GameState {
  return {
    t: 0, dist: 0, speed: K.START_SPEED, runSpeed: K.START_SPEED, touch,
    lane: 0, px: 0, y: 0, vy: 0, jumps: 0, jumpBuf: 0, slide: 0,
    lives: K.LIVES, inv: 0, score: 0,
    g: G_START, doses: [], cond: K.COND_START, redT: 0, tirT: 0, totT: 0, hypoWarned: false, hyperWarned: false,
    shield: 0, mult: 0, boost: 0, magnet: 0, turbo: 0, insShield: false,
    exGot: 0, exMiss: 0, qOk: 0, qTot: 0,
    quizT: K.QUIZ_EVERY, quizDue: false, boss: null, bossCount: 0, plate: null, nextPlate: K.PLATE_FIRST, nextPower: K.POWER_FIRST,
    day: 1, rain: 0, rainOn: false, nextRain: 35 + rng() * 25, rainEnd: 0,
    objs: [], nextRow: 30, nextId: 1, over: false, overReason: "", events: [],
  };
}

export const toast = (s: GameState, text: string, sec = 2.6) => s.events.push({ type: "toast", text, sec });
export const meters = (s: GameState) => s.dist / K.UNITS_PER_METER;
/** Porcentagem do tempo na faixa-alvo. */
export const timeInRange = (s: GameState) => (s.totT > 0 ? Math.round((100 * s.tirT) / s.totT) : 0);
