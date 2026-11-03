// Números de equilíbrio do jogo, copiados do GlycoRun original (mesmas unidades).
// z = distância à frente do jogador; 3 unidades = 1 metro.

export const UNITS_PER_METER = 3;
export const SPAWN_Z = 150; // onde as fileiras nascem
export const DESPAWN_Z = -5.1; // objetos atrás disso somem

export const LIVES = 3;
export const START_SPEED = 18;
export const SPEED_GAIN = { keyboard: { rate: 0.17, max: 28 }, touch: { rate: 0.13, max: 20 } };

export const GRAVITY = 24;
export const JUMP_V = 8.2;
export const JUMP_V_TURBO = [9.2, 10.5]; // 1º e 2º pulo com o Tênis do Boost
export const DIVE_V = -14; // abaixar no ar puxa para o chão
export const SLIDE_TIME = 0.65;
export const JUMP_BUFFER = 0.16; // toque um pouco antes de pousar ainda vale
export const LANE_SPEED = 14; // quão rápido o corpo chega à nova faixa

// Colisão: janela em z e distância lateral (em faixas).
export const HIT_Z = 1.1;
export const HIT_LANE = 0.5;
// Altura mínima para passar por cima de cada obstáculo.
export const CLEAR_SOFA_Y = 0.7;
export const CLEAR_PILHA_Y = 2.3;

export const HIT_INVULNERABLE = 1.6;
export const OBSTACLE_CHANCE = 0.42;
export const OBSTACLE_START_T = 4;
export const ITEM_CHANCE = 0.42;
