import * as THREE from "three";
import { ITEMS, type ItemKind } from "../content/items";
import { Builder, Prefab, textTexture } from "./builder";

/**
 * Modelos low-poly dos itens, obstáculos e do chefão.
 * Cada item fica sobre um anel no chão com a cor do significado (verde = comida de verdade, coral = ultraprocessado,
 * azul = exercício/água, roxo = medicação, dourado = power-up).
 */

export const KIND_COLOR: Record<ItemKind | "fix", number> = {
  good: 0x2fa866, water: 0x2f9ee0, ex: 0x2f7fe0, med: 0x8a5cd6, bad: 0xe2483d,
  veg: 0x2fa866, prot: 0xf08a3c, carb: 0xe8b21c, pw: 0xe8b21c, fix: 0x2fa866,
};

const W = 0xf6f4ee;

function bowl(b: Builder, color: number, fill: number) {
  b.cyl(0.26, 0.15, 0.18, 10, color, { y: 0.09 });
  b.cyl(0.24, 0.24, 0.03, 10, fill, { y: 0.17 });
}

type Make = (b: Builder) => void;
const MODELS: Record<string, Make> = {
  maca: (b) => { b.ball(0.25, 0xd8352a, { y: 0.25, sy: 0.92 }); b.cyl(0.02, 0.02, 0.12, 4, 0x5e4026, { y: 0.52 }); b.ball(0.08, 0x4caf50, { x: 0.08, y: 0.54, sy: 0.4, rz: -0.5 }, 0); },
  brocolis: (b) => { b.cyl(0.07, 0.09, 0.3, 6, 0x9ccc65, { y: 0.15 }); for (const [x, y, z] of [[0, 0.42, 0], [0.13, 0.36, 0.05], [-0.13, 0.36, 0.04], [0.05, 0.36, -0.13], [-0.04, 0.37, 0.14]]) b.ball(0.13, 0x2e8b3a, { x, y, z }, 0); },
  aveia: (b) => { bowl(b, 0x4f8fd6, 0xe9d3a2); for (let k = 0; k < 5; k++) b.ball(0.035, 0xc49a5a, { x: Math.cos(k) * 0.12, y: 0.2, z: Math.sin(k) * 0.12 }, 0); },
  salada: (b) => { bowl(b, W, 0x5aa83a); for (let k = 0; k < 6; k++) b.ball(0.06, k % 2 ? 0xe2483d : 0x7cc35a, { x: Math.cos(k * 1.1) * 0.13, y: 0.22, z: Math.sin(k * 1.1) * 0.13 }, 0); },
  cenoura: (b) => { b.cone(0.1, 0.5, 6, 0xf08a3c, { y: 0.25, rx: Math.PI }); for (const rz of [-0.3, 0, 0.3]) b.cone(0.04, 0.22, 4, 0x4caf50, { y: 0.58, rz }); },
  agua: (b) => { b.cyl(0.11, 0.11, 0.42, 8, 0x9fdcff, { y: 0.21 }); b.cyl(0.115, 0.115, 0.12, 8, 0x2f7fe0, { y: 0.22 }); b.cyl(0.05, 0.08, 0.08, 8, 0x9fdcff, { y: 0.46 }); b.cyl(0.05, 0.05, 0.05, 8, 0x2f7fe0, { y: 0.52 }); },
  remedio: (b) => { b.cyl(0.08, 0.08, 0.18, 8, 0xe2483d, { y: 0.3, rz: 0.9, x: -0.07 }); b.cyl(0.08, 0.08, 0.18, 8, W, { y: 0.3, rz: 0.9, x: 0.07, z: 0 }); b.ball(0.08, 0xe2483d, { x: -0.14, y: 0.24 }); b.ball(0.08, W, { x: 0.14, y: 0.37 }); },
  bike: (b) => { for (const x of [-0.25, 0.25]) b.torus(0.15, 0.025, 4, 12, 0x30363f, { x, y: 0.17 }); b.box(0.5, 0.035, 0.035, 0x2f7fe0, { y: 0.3 }); b.box(0.035, 0.2, 0.035, 0x2f7fe0, { x: -0.05, y: 0.25, rz: 0.4 }); b.box(0.14, 0.03, 0.06, 0x30363f, { x: -0.1, y: 0.4 }); b.box(0.035, 0.18, 0.035, 0x2f7fe0, { x: 0.2, y: 0.36 }); b.box(0.035, 0.03, 0.18, 0x30363f, { x: 0.2, y: 0.45 }); },
  bola: (b) => { b.sphere(0.24, 10, 8, 0xf08a3c, { y: 0.26 }); b.torus(0.242, 0.012, 3, 16, 0x3a2414, { y: 0.26 }); b.torus(0.242, 0.012, 3, 16, 0x3a2414, { y: 0.26, ry: Math.PI / 2 }); b.torus(0.242, 0.012, 3, 16, 0x3a2414, { y: 0.26, rx: Math.PI / 2 }); },
  refri: (b) => { b.cyl(0.14, 0.1, 0.42, 8, 0xe2483d, { y: 0.21 }); b.cyl(0.15, 0.15, 0.04, 8, W, { y: 0.43 }); b.cyl(0.015, 0.015, 0.25, 4, W, { x: 0.04, y: 0.55, rz: -0.2 }); b.cyl(0.142, 0.142, 0.08, 8, W, { y: 0.24 }); },
  bala: (b) => { b.ball(0.14, 0xff6fa8, { y: 0.28, sx: 1.2 }); b.cone(0.09, 0.14, 5, 0xffd1e8, { x: -0.23, y: 0.28, rz: -Math.PI / 2 }); b.cone(0.09, 0.14, 5, 0xffd1e8, { x: 0.23, y: 0.28, rz: Math.PI / 2 }); },
  suco: (b) => { b.box(0.24, 0.36, 0.16, 0xf2a83a, { y: 0.18 }); b.box(0.2, 0.14, 0.17, 0x7cc35a, { y: 0.16 }); b.cyl(0.012, 0.012, 0.18, 4, W, { x: 0.06, y: 0.43, rz: -0.2 }); },
  donut: (b) => { b.torus(0.17, 0.08, 6, 12, 0xc98a4a, { y: 0.24, rx: Math.PI / 2 - 0.5 }); b.torus(0.17, 0.065, 5, 12, 0xff6fa8, { y: 0.27, rx: Math.PI / 2 - 0.5, sz: 0.8 }); },
  burger: (b) => { b.sphere(0.24, 10, 5, 0xe3a24a, { y: 0.3, sy: 0.55 }); b.cyl(0.25, 0.25, 0.04, 10, 0x4cae4c, { y: 0.27 }); b.cyl(0.24, 0.24, 0.08, 10, 0x6b3a1e, { y: 0.21 }); b.cyl(0.25, 0.25, 0.03, 10, 0xffcf3f, { y: 0.16 }); b.cyl(0.23, 0.22, 0.09, 10, 0xe3a24a, { y: 0.1 }); },
  batata: (b) => { b.cyl(0.17, 0.12, 0.3, 4, 0xe2483d, { y: 0.15, ry: Math.PI / 4 }); for (let k = 0; k < 7; k++) b.box(0.035, 0.24, 0.035, 0xf4d03a, { x: -0.12 + k * 0.04, y: 0.36, z: (k % 2) * 0.05 - 0.02, rz: (k - 3) * 0.06 }); },
  alface: (b) => { for (let k = 0; k < 6; k++) b.ball(0.15, k % 2 ? 0x7cc35a : 0x5aa83a, { x: Math.cos(k) * 0.1, y: 0.22 + (k % 3) * 0.04, z: Math.sin(k) * 0.1, sy: 0.7 }, 0); },
  frango: (b) => { b.ball(0.17, 0xb8692e, { x: 0.05, y: 0.28, sx: 1.25 }); b.cyl(0.03, 0.03, 0.22, 5, W, { x: -0.18, y: 0.24, rz: 1.1 }); b.ball(0.045, W, { x: -0.28, y: 0.19 }, 0); },
  ovo: (b) => { b.sphere(0.15, 10, 8, 0xf7f1e3, { y: 0.24, sy: 1.3 }); },
  peixe: (b) => { b.ball(0.16, 0x6fa3c9, { y: 0.28, sx: 1.8, sz: 0.7 }); b.cone(0.13, 0.18, 4, 0x4f84ab, { x: -0.35, y: 0.28, rz: Math.PI / 2, sz: 0.4 }); b.ball(0.025, 0x14253d, { x: 0.18, y: 0.32, z: 0.08 }, 0); },
  arroz: (b) => { bowl(b, 0xe2b04a, W); b.sphere(0.21, 8, 5, W, { y: 0.18, sy: 0.55 }); },
  batatadoce: (b) => { b.ball(0.15, 0x8e4a5e, { y: 0.24, sx: 1.9, rz: 0.2 }); },
  milho: (b) => { b.cyl(0.1, 0.09, 0.42, 8, 0xf4d03a, { y: 0.3, rz: 0.3 }); b.cone(0.09, 0.4, 4, 0x6fbf4a, { x: 0.1, y: 0.18, rz: 0.9 }); b.cone(0.09, 0.4, 4, 0x6fbf4a, { x: -0.06, y: 0.16, rz: -0.6 }); },
  ima: (b) => { b.torus(0.17, 0.065, 6, 12, 0xe2483d, { y: 0.32 }, Math.PI); for (const x of [-0.17, 0.17]) { b.cyl(0.065, 0.065, 0.12, 6, 0xe2483d, { x, y: 0.27 }); b.cyl(0.066, 0.066, 0.1, 6, 0xd7dce2, { x, y: 0.17 }); } },
  tenis: (b) => { b.box(0.2, 0.06, 0.44, W, { y: 0.06 }); b.box(0.19, 0.16, 0.3, 0x2f7fe0, { y: 0.17, z: 0.06 }); b.box(0.18, 0.1, 0.16, 0x2f7fe0, { y: 0.14, z: -0.14 }); b.box(0.2, 0.02, 0.44, 0xff4f8b, { y: 0.03 }); b.box(0.04, 0.12, 0.2, 0xb6ff3b, { x: 0.1, y: 0.18, z: 0.05 }); },
  escudo: (b) => { b.cyl(0.26, 0.26, 0.07, 6, 0x8a5cd6, { y: 0.32, rx: Math.PI / 2, sy: 1, sx: 1, sz: 1.15 }); b.box(0.08, 0.24, 0.02, W, { y: 0.34, z: 0.05 }); b.box(0.24, 0.08, 0.02, W, { y: 0.34, z: 0.05 }); },
  aguaT: (b) => { b.cyl(0.14, 0.14, 0.5, 8, 0x5fc8ff, { y: 0.25 }); b.cyl(0.145, 0.145, 0.1, 8, 0xf2c230, { y: 0.2 }); b.cyl(0.06, 0.1, 0.08, 8, 0x5fc8ff, { y: 0.54 }); b.cyl(0.06, 0.06, 0.06, 8, 0x2f7fe0, { y: 0.61 }); b.box(0.04, 0.16, 0.2, 0xffffff, { x: 0.16, y: 0.3, rz: 0.4 }); b.box(0.04, 0.16, 0.2, 0xffffff, { x: -0.16, y: 0.3, rz: -0.4 }); },
};
MODELS.brocolisP = MODELS.brocolis;
MODELS.saladaP = MODELS.salada;

export function buildItemPrefabs(): Map<string, Prefab> {
  const out = new Map<string, Prefab>();
  for (const id of Object.keys(ITEMS)) {
    const b = new Builder();
    (MODELS[id] ?? MODELS.maca)(b);
    out.set(id, Prefab.of(b));
  }
  return out;
}

// ---------- Obstáculos ----------
export function buildObstaclePrefabs(): Map<string, Prefab> {
  const out = new Map<string, Prefab>();
  // Sofá com controle de videogame (pule!)
  const sofa = new Builder();
  const red = 0xc8473d, redD = 0x8e342e;
  sofa.box(1.85, 0.38, 0.95, red, { y: 0.32 });
  sofa.box(0.85, 0.14, 0.8, 0xd65a4f, { x: -0.44, y: 0.57, z: 0.05 });
  sofa.box(0.85, 0.14, 0.8, 0xd65a4f, { x: 0.44, y: 0.57, z: 0.05 });
  sofa.box(1.85, 0.55, 0.25, redD, { y: 0.78, z: -0.38, rx: 0.12 });
  for (const x of [-0.95, 0.95]) sofa.box(0.22, 0.55, 0.95, redD, { x, y: 0.47 });
  for (const [x, z] of [[-0.8, -0.38], [0.8, -0.38], [-0.8, 0.38], [0.8, 0.38]]) sofa.box(0.1, 0.13, 0.1, 0x3c2a24, { x, y: 0.065, z });
  sofa.box(0.28, 0.06, 0.14, 0x30363f, { x: 0.35, y: 0.67, rz: 0.1 });
  sofa.box(0.5, 0.18, 0.4, 0xe2c36a, { x: -0.5, y: 0.73, z: -0.2, rx: -0.2 }); // almofada
  out.set("sofa", Prefab.of(sofa));

  // TV grande num suporte (abaixe!)
  const tela = new Builder();
  for (const x of [-0.98, 0.98]) {
    tela.box(0.1, 2.4, 0.1, 0x3b4250, { x, y: 1.2 });
    tela.box(0.4, 0.06, 0.5, 0x3b4250, { x, y: 0.03 });
  }
  tela.box(2.0, 0.08, 0.12, 0x3b4250, { y: 2.38 });
  tela.box(2.0, 1.05, 0.14, 0x1b2230, { y: 1.78 });
  tela.box(1.82, 0.88, 0.04, 0x2c6fd6, { y: 1.78, z: 0.08, glow: true });
  tela.cone(0.18, 0.3, 3, 0xffffff, { y: 1.78, z: 0.11, rz: -Math.PI / 2, sz: 0.1, glow: true });
  out.set("tela", Prefab.of(tela));

  // Pilha de telas: monitores, tablet e celular (desvie!)
  const pilha = new Builder();
  const screens = [0xff7a59, 0x5ad1a8, 0xffd166];
  for (let i = 0; i < 3; i++) {
    const y = 0.42 + i * 0.8, w = 1.7 - i * 0.15;
    pilha.box(w, 0.76, 0.85, i % 2 ? 0x2a3242 : 0x353e50, { y, ry: (i - 1) * 0.08 });
    pilha.box(w - 0.22, 0.54, 0.04, screens[i], { y, z: 0.44, ry: (i - 1) * 0.08, glow: true });
  }
  pilha.box(0.36, 0.62, 0.06, 0x14171d, { x: 0.2, y: 2.75, rx: -0.12 });
  pilha.box(0.3, 0.52, 0.02, 0x8ad4ff, { x: 0.2, y: 2.75, z: 0.04, rx: -0.12, glow: true });
  out.set("pilha", Prefab.of(pilha));
  return out;
}

/** Placa flutuante com a dica do obstáculo (ajuda crianças). */
export const OBSTACLE_HINT: Record<string, { text: string; y: number }> = {
  sofa: { text: "PULE ↑", y: 1.55 },
  tela: { text: "ABAIXE ↓", y: 2.95 },
  pilha: { text: "DESVIE ←→", y: 3.45 },
  pilhaTurbo: { text: "PULO DUPLO ↑↑", y: 3.45 },
};
export function hintMaterial(text: string, w = 256): THREE.SpriteMaterial {
  return new THREE.SpriteMaterial({ map: textTexture(text, { w, h: 64, bg: "rgba(20,37,61,.85)", fg: "#fff" }), depthWrite: false });
}

// ---------- Chefão Ultraprocessado ----------
export function buildBoss(type: "lata" | "burger"): THREE.Group {
  const g = new THREE.Group();
  const b = new Builder();
  if (type === "lata") {
    b.cyl(1.5, 1.5, 3.4, 14, 0xe8463c);
    b.cyl(1.52, 1.52, 0.5, 14, W, { y: -0.6 });
    b.cyl(1.4, 1.5, 0.2, 14, 0xc9ced6, { y: 1.8 });
    b.cyl(1.5, 1.4, 0.2, 14, 0xc9ced6, { y: -1.8 });
    b.box(0.5, 0.08, 0.25, 0xa7adb6, { y: 1.93, z: 0.3 });
  } else {
    b.sphere(1.9, 14, 7, 0xe3a24a, { y: 0.7, sy: 0.6 });
    for (let k = 0; k < 8; k++) b.ball(0.08, 0xfff4d6, { x: Math.cos(k) * 1.1, y: 1.65, z: Math.sin(k) * 1.0 - 0.3 }, 0);
    b.cyl(2.0, 2.0, 0.18, 14, 0x4cae4c, { y: 0.6 });
    b.cyl(1.9, 1.9, 0.5, 14, 0x6b3a1e, { y: 0.25 });
    b.cyl(2.0, 2.0, 0.12, 14, 0xffcf3f, { y: -0.05 });
    b.cyl(1.8, 1.75, 0.6, 14, 0xe3a24a, { y: -0.4 });
  }
  // braços
  for (const s of [-1, 1]) b.cyl(0.14, 0.14, 1.2, 6, type === "lata" ? 0xc9ced6 : 0xe3a24a, { x: s * 1.9, y: 0.1, rz: s * 0.9 });
  // rosto bravo (olha para a câmera, +z)
  const ey = type === "lata" ? 0.5 : 0.95, ez = type === "lata" ? 1.42 : 1.55;
  for (const s of [-1, 1]) {
    b.sphere(0.3, 10, 8, W, { x: s * 0.55, y: ey, z: ez, sz: 0.5 });
    b.sphere(0.14, 8, 6, 0x14253d, { x: s * 0.5, y: ey - 0.03, z: ez + 0.12, sz: 0.5 });
    b.box(0.62, 0.11, 0.1, 0x14253d, { x: s * 0.55, y: ey + 0.38, z: ez + 0.1, rz: s * -0.35 });
  }
  b.torus(0.32, 0.06, 4, 10, 0x14253d, { y: ey - 0.55, z: ez + 0.05, rz: Math.PI }, Math.PI);
  const body = new THREE.Mesh(b.build(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  g.add(body);
  const label = new THREE.Sprite(hintMaterial("CHEFÃO ULTRAPROCESSADO", 448));
  label.scale.set(5.6, 0.8, 1);
  label.position.y = 3.1;
  g.add(label);
  g.visible = false;
  return g;
}
