import { LIVES, START_SPEED } from "./constants";

export type Action = "L" | "R" | "U" | "D";
export type ObstacleType = "sofa" | "tela" | "pilha";

export interface WorldObject {
  id: number;
  kind: "obs" | "item";
  type: string; // tipo do obstáculo ou id do item
  lx: number; // posição lateral em faixas (-1, 0, 1; o ímã pode puxar para valores intermediários)
  z: number; // distância à frente do jogador
  done: boolean;
}

/** Acontecimentos de um quadro, para a renderização, o som e a interface reagirem. */
export type GameEvent =
  | { type: "jump"; double: boolean }
  | { type: "land" }
  | { type: "slide" }
  | { type: "lane"; dir: -1 | 1 }
  | { type: "hit"; obstacle: ObstacleType; livesLeft: number }
  | { type: "collect"; obj: WorldObject }
  | { type: "gameOver" };

export interface GameState {
  t: number; // segundos de corrida
  dist: number; // unidades percorridas
  speed: number;
  touch: boolean; // celular: aceleração mais suave
  // jogador
  lane: -1 | 0 | 1;
  px: number; // posição lateral suavizada
  y: number;
  vy: number;
  jumps: number;
  jumpBuf: number;
  slide: number;
  turbo: number; // Tênis do Boost (etapa 2): permite pulo duplo
  lives: number;
  inv: number; // invencível após batida
  score: number;
  // mundo
  objs: WorldObject[];
  nextRow: number;
  nextId: number;
  over: boolean;
  events: GameEvent[];
}

export function createGame(touch: boolean): GameState {
  return {
    t: 0, dist: 0, speed: START_SPEED, touch,
    lane: 0, px: 0, y: 0, vy: 0, jumps: 0, jumpBuf: 0, slide: 0, turbo: 0,
    lives: LIVES, inv: 0, score: 0,
    objs: [], nextRow: 30, nextId: 1, over: false, events: [],
  };
}
