import { Builder, Prefab } from "./builder";

/**
 * Modelos do cenário "Bairro Vivo". Todos montados para o lado DIREITO da rua:
 * a frente olha para -x (para a rua) e o ponto (0,0,0) é o canto da frente no chão.
 * No lado esquerdo, o cenário gira 180°.
 */

const WALLS = [0xf4d58d, 0x9ad0c2, 0xf2a7a0, 0xa7c7e7, 0xf3eee2, 0xe9b872, 0xc9b6e4];
const DOORS = [0x6b4a33, 0x2f5d7a, 0x8e3b2f, 0x3c6b48];
const GLASS = 0x9fd3ee;
const WHITE = 0xf6f4ee;
const TILE = 0xb5523b;

function house(i: number): Builder {
  const b = new Builder();
  const wall = WALLS[i % WALLS.length], door = DOORS[i % DOORS.length];
  const w = 4.2, h = 2.7, d = 6;
  b.box(w, h, d, wall, { x: w / 2 + 1.2, y: h / 2 });
  b.box(w + 0.3, 0.15, d + 0.3, WHITE, { x: w / 2 + 1.2, y: h }); // beiral
  b.roof(w + 0.6, 1.3, d + 0.6, TILE, { x: w / 2 + 1.2, y: h + 0.07 });
  // fachada
  b.box(0.06, 1.95, 0.95, door, { x: 1.17, y: 0.98, z: -0.6 });
  for (const z of [1.5, -2.3]) {
    b.box(0.08, 1.0, 1.15, WHITE, { x: 1.18, y: 1.55, z });
    b.box(0.06, 0.82, 0.95, GLASS, { x: 1.16, y: 1.55, z, glow: true });
  }
  // lateral que vem na direção da câmera
  b.box(1.3, 0.9, 0.06, GLASS, { x: 3.3, y: 1.6, z: d / 2 + 0.01, glow: true });
  // muro baixo com portão (bem brasileiro)
  const muro = WALLS[(i + 3) % WALLS.length];
  b.box(0.18, 1.1, 2.4, muro, { x: 0, y: 0.55, z: 1.8 });
  b.box(0.18, 1.1, 1.6, muro, { x: 0, y: 0.55, z: -2.2 });
  for (let k = 0; k < 6; k++) b.box(0.04, 1.2, 0.04, 0x30363f, { x: 0, y: 0.6, z: 0.4 - k * 0.2 }); // portão
  b.box(0.2, 0.06, 0.06, 0x30363f, { x: 0, y: 1.15, z: -0.1, sz: 20 });
  b.box(1.2, 0.02, d, 0x8fbf6a, { x: 0.6, y: 0.01 }); // quintal
  return b;
}

function sobrado(i: number): Builder {
  const b = new Builder();
  const wall = WALLS[(i + 2) % WALLS.length];
  const w = 4.4, h = 5.2, d = 6.2;
  b.box(w, h, d, wall, { x: w / 2 + 0.6, y: h / 2 });
  b.box(w + 0.2, 0.25, d + 0.2, WHITE, { x: w / 2 + 0.6, y: h + 0.1 }); // laje
  // caixa-d'água azul na laje
  b.cyl(0.55, 0.5, 0.8, 10, 0x2f7fc6, { x: w / 2 + 1.2, y: h + 0.62, z: 1.2 });
  b.cyl(0.58, 0.58, 0.08, 10, 0x2566a3, { x: w / 2 + 1.2, y: h + 1.05, z: 1.2 });
  // portas e janelas
  b.box(0.06, 2.0, 2.2, 0x5b6470, { x: 0.57, y: 1.0, z: 1.2 }); // garagem
  b.box(0.06, 1.9, 0.9, DOORS[i % DOORS.length], { x: 0.57, y: 0.95, z: -1.6 });
  for (const z of [1.5, -1.5]) {
    b.box(0.08, 1.0, 1.3, WHITE, { x: 0.58, y: 3.6, z });
    b.box(0.06, 0.85, 1.12, GLASS, { x: 0.56, y: 3.6, z, glow: true });
  }
  // sacada
  b.box(0.7, 0.1, 2.6, WHITE, { x: 0.25, y: 2.75, z: 0 });
  b.box(0.05, 0.6, 2.6, 0x30363f, { x: -0.08, y: 3.05, z: 0 });
  b.box(1.6, 0.9, 0.06, GLASS, { x: 2.8, y: 3.6, z: d / 2 + 0.01, glow: true });
  return b;
}

function predio(i: number): Builder {
  const b = new Builder();
  const wall = [0xe8e2d4, 0xc9d8e2, 0xf0d9b5, 0xd8c8e0][i % 4];
  const floors = 5 + (i % 4) * 2, fh = 2.6, w = 6, d = 9;
  const h = floors * fh;
  b.box(w, h, d, wall, { x: w / 2 + 1.5, y: h / 2 });
  b.box(w + 0.3, 0.4, d + 0.3, WHITE, { x: w / 2 + 1.5, y: h + 0.2 });
  for (let f = 1; f < floors; f++) {
    const y = f * fh + 1.2;
    for (const z of [-3, 0, 3]) {
      b.box(0.06, 1.1, 1.6, GLASS, { x: 1.47, y, z, glow: true });
      b.box(0.8, 0.08, 2.0, WHITE, { x: 1.1, y: y - 0.7, z }); // varandinha
    }
    b.box(2.0, 1.1, 0.06, GLASS, { x: 4.5, y, z: d / 2 + 0.01, glow: true });
  }
  b.box(0.06, 2.2, 3, 0x5f7f99, { x: 1.47, y: 1.1, z: 0, glow: true }); // portaria
  b.box(1.2, 0.15, 4, WHITE, { x: 0.9, y: 2.4, z: 0 });
  return b;
}

function ipe(color: number): Builder {
  const b = new Builder();
  b.cyl(0.13, 0.18, 2.2, 6, 0x6e4a2e, { y: 1.1 });
  b.cyl(0.07, 0.09, 1.0, 5, 0x6e4a2e, { x: 0.3, y: 2.2, rz: -0.6 });
  b.cyl(0.07, 0.09, 1.0, 5, 0x6e4a2e, { x: -0.25, y: 2.25, rz: 0.6 });
  for (const [x, y, z, r] of [[0, 2.9, 0, 0.95], [0.7, 2.6, 0.2, 0.7], [-0.6, 2.7, -0.2, 0.75], [0.1, 3.4, 0.3, 0.6], [-0.2, 2.5, 0.6, 0.55]]) {
    b.ball(r, color, { x, y, z }, 0);
  }
  b.cyl(0.6, 0.6, 0.02, 8, 0x6b5a3a, { y: 0.01 }); // canteiro
  return b;
}

function mangueira(): Builder {
  const b = new Builder();
  b.cyl(0.18, 0.25, 1.8, 6, 0x5e4026, { y: 0.9 });
  for (const [x, y, z, r] of [[0, 2.6, 0, 1.4], [0.9, 2.2, 0.3, 0.9], [-0.9, 2.3, -0.2, 1.0], [0.2, 3.3, -0.3, 0.9]]) b.ball(r, 0x3f8f3a, { x, y, z }, 0);
  for (const [x, y, z] of [[0.8, 1.8, -0.6], [-0.7, 1.9, 0.7], [0.3, 1.7, 0.9]]) b.ball(0.12, 0xf2a83a, { x, y, z }, 0);
  return b;
}

function coqueiro(i: number): Builder {
  const b = new Builder();
  let x = 0, y = 0;
  const lean = i % 2 ? 0.12 : -0.08;
  for (let k = 0; k < 6; k++) {
    b.cyl(0.13 - k * 0.01, 0.15 - k * 0.01, 0.9, 6, k % 2 ? 0x8a6a45 : 0x7b5c3a, { x, y: y + 0.45, rz: -lean });
    x += lean * 0.9;
    y += 0.88;
  }
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    b.box(1.9, 0.04, 0.38, k % 2 ? 0x3e9a4a : 0x4bb35a, { x: x + Math.cos(a) * 0.85, y: y - 0.25, z: Math.sin(a) * 0.85, ry: -a, rz: -0.45 });
  }
  for (let k = 0; k < 3; k++) b.ball(0.13, 0x6b4a2a, { x: x + Math.cos(k * 2) * 0.18, y: y - 0.2, z: Math.sin(k * 2) * 0.18 }, 0);
  return b;
}

function poste(): Builder {
  const b = new Builder();
  b.cyl(0.07, 0.09, 4.6, 6, 0x4a5462, { y: 2.3 });
  b.box(1.2, 0.07, 0.07, 0x4a5462, { x: -0.55, y: 4.55 });
  b.box(0.42, 0.14, 0.24, 0x30363f, { x: -1.1, y: 4.5 });
  b.box(0.34, 0.05, 0.18, 0xfff3c4, { x: -1.1, y: 4.41, glow: true });
  return b;
}

function banco(): Builder {
  const b = new Builder();
  for (const y of [0.45, 0.75, 0.9]) b.box(0.42, 0.06, 1.8, 0x9a6a3c, { x: y > 0.5 ? 0.25 : 0, y, rz: y > 0.5 ? -0.15 : 0 });
  for (const z of [-0.75, 0.75]) b.box(0.42, 0.45, 0.07, 0x30363f, { y: 0.22, z });
  return b;
}

function barraca(i: number): Builder {
  const b = new Builder();
  const stripes = [[0x2f7fe0, WHITE], [0xf08a3c, WHITE], [0x2fa866, 0xf4d58d], [0xe2483d, WHITE]][i % 4];
  for (const [x, z] of [[0, -1.4], [0, 1.4], [1.8, -1.4], [1.8, 1.4]]) b.cyl(0.04, 0.04, 2.3, 5, 0x8a8f99, { x, y: 1.15, z });
  // lona listrada inclinada
  for (let k = 0; k < 6; k++) b.box(2.2, 0.05, 0.5, stripes[k % 2], { x: 0.9, y: 2.35, z: -1.25 + k * 0.5, rz: 0.18 });
  b.box(1.4, 0.8, 2.8, 0xb88a5a, { x: 0.9, y: 0.4 }); // bancada
  // caixotes de frutas e verduras
  const fruits = [0xe2483d, 0xf2a83a, 0x5aa83a, 0xf4d03a, 0x8e3b8f, 0xf08a3c];
  for (let k = 0; k < 4; k++) {
    const z = -1.0 + k * 0.68;
    b.box(0.6, 0.18, 0.6, 0x9a6a3c, { x: 0.55, y: 0.89, z });
    const c = fruits[(i + k) % fruits.length];
    for (let f = 0; f < 4; f++) b.ball(0.11, c, { x: 0.45 + (f % 2) * 0.2, y: 1.04, z: z - 0.12 + Math.floor(f / 2) * 0.24 }, 0);
  }
  b.box(0.06, 0.4, 1.2, WHITE, { x: -0.05, y: 1.95, z: 0, glow: true }); // plaquinha de preço
  return b;
}

function caixotes(): Builder {
  const b = new Builder();
  for (const [x, y, z] of [[0, 0.25, 0], [0.6, 0.25, 0.1], [0.3, 0.75, 0.05]]) b.box(0.55, 0.5, 0.55, 0x9a6a3c, { x, y, z });
  for (let f = 0; f < 4; f++) b.ball(0.1, 0x5aa83a, { x: 0.22 + (f % 2) * 0.16, y: 1.05, z: -0.05 + Math.floor(f / 2) * 0.16 }, 0);
  return b;
}

function quiosque(): Builder {
  const b = new Builder();
  b.cyl(1.3, 1.3, 1.1, 6, WHITE, { x: 1.4, y: 0.55 });
  b.cyl(1.35, 1.35, 0.1, 6, 0x2f7fe0, { x: 1.4, y: 1.12 });
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; b.cyl(0.04, 0.04, 1.3, 4, 0x8a8f99, { x: 1.4 + Math.cos(a) * 1.15, y: 1.8, z: Math.sin(a) * 1.15 }); }
  b.cone(2.0, 1.0, 6, 0xd9b26a, { x: 1.4, y: 2.95 });
  b.box(0.06, 0.35, 1.4, 0xf2c230, { x: 0.15, y: 2.2, glow: true });
  return b;
}

function guardaSol(i: number): Builder {
  const b = new Builder();
  const [c1, c2] = [[0xe2483d, WHITE], [0x2f7fe0, 0xf4d58d], [0x2fa866, WHITE]][i % 3];
  b.cyl(0.03, 0.03, 2.1, 4, 0xdedede, { y: 1.05, rz: 0.1 });
  b.cone(1.1, 0.5, 8, c1, { x: 0.2, y: 2.2 });
  b.cone(0.6, 0.3, 8, c2, { x: 0.2, y: 2.36 });
  b.box(0.5, 0.06, 1.2, c2, { x: 0.8, y: 0.25, rz: 0.3 }); // cadeira de praia
  b.box(0.5, 0.06, 0.8, c1, { x: 0.8, y: 0.5, z: 0.5, rx: 0.8 });
  return b;
}

function cerca(): Builder {
  const b = new Builder();
  for (let k = 0; k < 7; k++) b.box(0.08, 0.8, 0.08, WHITE, { y: 0.4, z: -9 + k * 3 });
  for (const y of [0.35, 0.7]) b.box(0.05, 0.08, 20, WHITE, { y });
  return b;
}

function pontoOnibus(): Builder {
  const b = new Builder();
  b.box(0.1, 2.4, 0.1, 0x5b6470, { x: 1.1, y: 1.2, z: -1.4 });
  b.box(0.1, 2.4, 0.1, 0x5b6470, { x: 1.1, y: 1.2, z: 1.4 });
  b.box(1.4, 0.08, 3.2, 0x2fa866, { x: 0.6, y: 2.4 });
  b.box(0.05, 1.6, 3.0, GLASS, { x: 1.15, y: 1.3, glow: true });
  b.box(0.4, 0.06, 2.6, 0x9a6a3c, { x: 0.9, y: 0.5 });
  return b;
}

function lixeira(): Builder {
  const b = new Builder();
  b.cyl(0.22, 0.18, 0.7, 8, 0xf08a3c, { y: 0.35 });
  b.cyl(0.24, 0.24, 0.06, 8, 0x30363f, { y: 0.72 });
  return b;
}

/** Chão ao lado da rua por bioma (calçada é desenhada à parte com textura). */
function verge(color: number, sea: boolean): Builder {
  const b = new Builder();
  if (sea) {
    b.box(9, 0.04, 20.2, 0xe8d49a, { x: 4.5, y: -0.02 }); // areia
    b.box(80, 0.04, 20.2, 0x2f8fc9, { x: 49, y: -0.08 }); // mar
    for (let k = 0; k < 3; k++) b.box(0.25, 0.03, 20.2, WHITE, { x: 9.3 + k * 1.6, y: -0.05 }); // espuma
  } else b.box(60, 0.04, 20.2, color, { x: 30, y: -0.02 });
  return b;
}

export type PropId = string;

/** Constrói todos os modelos uma vez (fica na memória da placa de vídeo, reaproveitado). */
export function buildPrefabs(): Map<PropId, Prefab> {
  const P = new Map<PropId, Prefab>();
  const put = (id: string, b: Builder) => P.set(id, Prefab.of(b));
  for (let i = 0; i < 6; i++) put(`casa${i}`, house(i));
  for (let i = 0; i < 4; i++) put(`sobrado${i}`, sobrado(i));
  for (let i = 0; i < 4; i++) put(`predio${i}`, predio(i));
  put("ipeRosa", ipe(0xe86fa8));
  put("ipeAmarelo", ipe(0xf2c230));
  put("ipeRoxo", ipe(0xa86fd8));
  put("mangueira", mangueira());
  for (let i = 0; i < 2; i++) put(`coqueiro${i}`, coqueiro(i));
  put("poste", poste());
  put("banco", banco());
  for (let i = 0; i < 4; i++) put(`barraca${i}`, barraca(i));
  put("caixotes", caixotes());
  put("quiosque", quiosque());
  for (let i = 0; i < 3; i++) put(`guardaSol${i}`, guardaSol(i));
  put("cerca", cerca());
  put("ponto", pontoOnibus());
  put("lixeira", lixeira());
  put("vergeGrass", verge(0x7cc35a, false));
  put("vergePark", verge(0x5fb848, false));
  put("vergePlaza", verge(0xcfc3ad, false));
  put("vergeSea", verge(0, true));
  return P;
}
