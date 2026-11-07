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
// Acima desta altura o item passa por baixo do jogador (mesma altura de pular o sofá).
export const COLLECT_MAX_Y = 0.7;

export const HIT_INVULNERABLE = 1.6;
export const OBSTACLE_CHANCE = 0.42;
export const OBSTACLE_START_T = 4;
export const ITEM_CHANCE = 0.42;

// Glicemia
export const G_DECAY = 1.1; // queda natural por segundo
export const G_DECAY_BOOST = 1.2; // queda extra com exercício/boost
export const G_TENIS_EXTRA = 3; // Tênis: normaliza mais rápido acima de TENIS_ABOVE
export const TENIS_ABOVE = 120; // original: 140 com alvo até 180; ajustado ao alvo 70–140
export const RED_LIMIT = 4; // segundos no vermelho até perder uma vida
export const RESET_LOW = 95;
export const RESET_HIGH = 130; // original: 150 com alvo até 180
export const SLOW_HYPO = 0.8;
export const SLOW_HYPER = 0.9;
export const LANE_SPEED_HYPO = 8;

// Condicionamento (0–100): começa baixo e muda o corpo do personagem
export const COND_START = 15;

// Eventos
export const QUIZ_EVERY = 30;
export const BOSS_EVERY_M = 500;
export const BOSS_DUR = 10;
export const BOSS_WIN_BONUS = 500;
export const PLATE_FIRST = 50;
export const PLATE_EVERY = 70;
export const PLATE_DUR = 6.5;
export const PLATE_BONUS = 400;
export const POWER_FIRST = 12;
export const DAY_CYCLE = 90; // segundos de um dia completo
