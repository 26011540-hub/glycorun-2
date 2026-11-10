import * as THREE from "three";
import type { SkinId } from "../content/texts";
import { seeded, textTexture } from "./builder";
import { assemble, JOINTS, loft, rigid, type Joint, type Part, type Ring, type Role, type Weights } from "./body";

/**
 * Personagem original do GlycoRun 2: corpo contínuo gerado em código (ver body.ts), com esqueleto real.
 * Proporções humanas (~7,9 cabeças, altura ~1,77). Ele corre para -z (de costas para a câmera).
 * Engordar e emagrecer é uma deformação suave do próprio corpo (decisão do autor).
 * Tudo vira uma malha só: 1 chamada de desenho para o personagem inteiro (+1 para o letreiro do ACS).
 */

/** Ângulos de uma pose (radianos) + altura do quadril. */
interface Pose {
  hipY: number; hipsRx: number;
  torsoRx: number; torsoRy: number; torsoRz: number; headRx: number;
  armLx: number; armLz: number; armRx: number; armRz: number; foreL: number; foreR: number;
  thighL: number; thighR: number; thighLz: number; thighRz: number; shinL: number; shinR: number; footL: number; footR: number;
}
const KEYS = [
  "hipY", "hipsRx", "torsoRx", "torsoRy", "torsoRz", "headRx", "armLx", "armLz", "armRx", "armRz", "foreL", "foreR",
  "thighL", "thighR", "thighLz", "thighRz", "shinL", "shinR", "footL", "footR",
] as const;

const HIP_Y = 0.95;
const ARM_X = 0.2;
const STAND: Pose = {
  hipY: HIP_Y, hipsRx: 0, torsoRx: 0, torsoRy: 0, torsoRz: 0, headRx: 0,
  armLx: 0.05, armLz: -0.12, armRx: 0.05, armRz: 0.12, foreL: 0.25, foreR: 0.25,
  thighL: 0, thighR: 0, thighLz: 0, thighRz: 0, shinL: 0, shinR: 0, footL: 0, footR: 0,
};

export type Motion = "idle" | "run" | "jump" | "fall" | "slide" | "tired";

export interface AnimInput {
  motion: Motion;
  speed: number; // velocidade do jogo (para a cadência)
  lean: number; // -1..1 inclinação ao trocar de faixa
  hypo: boolean;
  hyper: boolean;
}

// ---------- Aparência ----------
const SKIN_TONE = 0x9a6847;
interface Outfit { shirt: number; vest?: number; shorts: number; band: number; shoe: number; sole: number; legs?: number; hand?: number; sleeve?: number }
const OUTFIT: Record<SkinId, Outfit> = {
  corredor: { shirt: 0x2f7fe0, shorts: 0x22324a, band: 0x18263a, shoe: 0xb6ff3b, sole: 0xff4f8b },
  fone: { shirt: 0x6f55e0, shorts: 0x2a2f45, band: 0x1c2032, shoe: 0xf4f4f4, sole: 0x6f55e0 },
  mochila: { shirt: 0xf08a3c, shorts: 0x22324a, band: 0x18263a, shoe: 0xf4f4f4, sole: 0xe2483d },
  acs: { shirt: 0xe9f1fa, vest: 0x1f5fa8, shorts: 0x3a4a63, band: 0x2c394e, shoe: 0x2e2a28, sole: 0x111111, legs: 0x3a4a63 },
  // jaleco branco por cima do pijama cirúrgico verde-azulado
  medico: { shirt: 0xf7f8f6, vest: 0xf7f8f6, shorts: 0x2f8f9d, band: 0xf7f8f6, shoe: 0xf4f6f8, sole: 0x2f8f9d, legs: 0x2f8f9d, hand: 0x7fb3e6, sleeve: 0xf2f4f2 }, // luvas cirúrgicas azuis
};
const HYPER_SHIRT = new THREE.Color(0xe46a4f);

const one = (j: Joint): Weights => [[j, 1]];
const mix = (a: Joint, b: Joint, t: number): Weights => [[a, 1 - t], [b, t]];

/** Peças do cabelo: casca facetada e irregular, em dois tons (como no modelo de referência). */
function hair(): THREE.BufferGeometry[] {
  const base = new THREE.IcosahedronGeometry(1, 2);
  const a = base.attributes.position;
  const noise = new Map<string, number>();
  const rnd = seeded(41);
  const out: number[][] = [[], []];
  const v = new THREE.Vector3();
  const map = (i: number): THREE.Vector3 => {
    v.fromBufferAttribute(a, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!noise.has(key)) noise.set(key, rnd());
    const r = noise.get(key)!;
    const n = 1 + (r - 0.5) * 0.24;
    // linha do cabelo: alta na testa, baixa na nuca
    const line = v.z < -0.2 ? 0.34 - 0.3 * Math.abs(v.x) : v.z < 0.2 ? -0.05 : -0.6;
    const y = Math.max(v.y, line - (r - 0.5) * 0.14);
    return new THREE.Vector3(v.x * 0.122 * n, y * 0.124 * n + 1.672, v.z * 0.13 * n + 0.006);
  };
  for (let i = 0; i < a.count; i += 3) {
    const t = rnd() < 0.24 ? 1 : 0;
    for (let k = 0; k < 3; k++) { const p = map(i + k); out[t].push(p.x, p.y, p.z); }
  }
  base.dispose();
  return out.map((list) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(list, 3));
    return g;
  });
}

/**
 * Aba longa do jaleco (do quadril ao joelho), aberta na frente. Cada metade acompanha um pouco a coxa
 * do seu lado, então o jaleco balança ao correr em vez de atravessar as pernas.
 * inner = forro: a mesma peça um pouco menor, virada para dentro.
 */
function coatSkirt(color: number, inner: boolean): Part {
  const top = 1.0, bot = 0.5, GAP = 0.9, d = inner ? 0.006 : 0;
  const g = new THREE.CylinderGeometry(0.205 - d, 0.25 - d, top - bot, 22, 4, true, Math.PI + GAP / 2, Math.PI * 2 - GAP).toNonIndexed();
  g.scale(1, 1, 0.8);
  g.translate(0, (top + bot) / 2, 0.01);
  const a = g.attributes.position, rnd = seeded(inner ? 71 : 72);
  const part: Part = { pos: [], fat: [], bones: [], wts: [], roles: [], shade: [], skin: "medico" };
  const hips = JOINTS.indexOf("hips"), L = JOINTS.indexOf("thighL"), R = JOINTS.indexOf("thighR");
  for (let i = 0; i < a.count; i += 3) {
    const tone = (inner ? 0.86 : 1) * (1 + (rnd() - 0.5) * 0.06);
    for (const k of inner ? [0, 2, 1] : [0, 1, 2]) {
      const x = a.getX(i + k), y = a.getY(i + k), z = a.getZ(i + k), len = Math.hypot(x, z) || 1;
      const t = Math.max(0, Math.min(1, (0.95 - y) / 0.45)) * 0.55;
      part.pos.push(x, y, z);
      part.fat.push((x / len) * 0.07, 0, (z / len) * 0.07);
      part.bones.push(hips, x < 0 ? L : R);
      part.wts.push(1 - t, t);
      part.roles.push(color);
      part.shade.push(tone * (0.9 + 0.12 * (y - bot) / (top - bot)));
    }
  }
  g.dispose();
  return part;
}

function buildParts(): Part[] {
  const S = THREE.SphereGeometry, B = THREE.BoxGeometry, Cy = THREE.CylinderGeometry, To = THREE.TorusGeometry, Co = THREE.ConeGeometry;
  const P: Part[] = [];
  const hipsW = one("hips"), torsoW = one("torso");

  // ----- tronco, do quadril ao pescoço -----
  const T: Role = "vest"; // o tronco usa a cor do colete; sem colete, é a própria camiseta
  const torso: Ring[] = [
    { y: 0.79, rx: 0.03, rf: 0.04, role: "shorts", w: hipsW, sh: 0.8 },
    { y: 0.83, rx: 0.12, rf: 0.092, rb: 0.1, role: "shorts", w: hipsW, sh: 0.86 },
    { y: 0.89, rx: 0.15, rf: 0.098, rb: 0.112, role: "shorts", w: hipsW, fx: 0.02, ff: 0.02, fb: 0.03, sh: 0.92 },
    { y: 0.96, rx: 0.165, rf: 0.1, rb: 0.125, role: "shorts", w: hipsW, fx: 0.04, ff: 0.03, fb: 0.045, sq: 0.85 },
    { y: 1.02, rx: 0.158, rf: 0.098, rb: 0.112, role: "band", w: mix("hips", "torso", 0.2), fx: 0.05, ff: 0.055, fb: 0.04, sq: 0.85 },
    { y: 1.05, rx: 0.155, rf: 0.098, rb: 0.108, role: T, w: mix("hips", "torso", 0.4), fx: 0.05, ff: 0.06, fb: 0.04, sq: 0.85, sh: 0.8 },
    { y: 1.05, rx: 0.166, rf: 0.108, rb: 0.118, role: T, w: mix("hips", "torso", 0.4), fx: 0.05, ff: 0.06, fb: 0.04, sq: 0.85, sh: 0.9 },
    { y: 1.13, rx: 0.15, rf: 0.1, rb: 0.104, role: T, w: mix("hips", "torso", 0.8), fx: 0.06, ff: 0.095, fb: 0.04, sh: 0.96 },
    { y: 1.22, rx: 0.156, rf: 0.11, rb: 0.108, role: T, w: torsoW, fx: 0.055, ff: 0.085, fb: 0.04 },
    { y: 1.32, rx: 0.176, rf: 0.124, rb: 0.118, role: T, w: torsoW, fx: 0.04, ff: 0.05, fb: 0.035, sq: 0.85, sh: 1.05 },
    { y: 1.4, rx: 0.2, rf: 0.114, rb: 0.114, role: T, w: torsoW, fx: 0.05, ff: 0.03, fb: 0.03, sq: 0.8, sh: 1.08 },
    { y: 1.45, rx: 0.2, rf: 0.082, rb: 0.09, role: "shirt", w: torsoW, fx: 0.05, ff: 0.015, fb: 0.02, sq: 0.8 },
    { y: 1.475, rx: 0.13, rf: 0.07, rb: 0.078, role: "shirt", w: torsoW, fx: 0.02, ff: 0.012, fb: 0.015, sh: 1.05 },
    { y: 1.49, rx: 0.074, rf: 0.066, rb: 0.07, role: "skin", w: torsoW, fx: 0.012, ff: 0.012, fb: 0.012 },
    { y: 1.52, rx: 0.053, rf: 0.052, rb: 0.056, role: "skin", w: mix("torso", "head", 0.3), fx: 0.01, ff: 0.01, sh: 0.9 },
    { y: 1.59, rx: 0.048, rf: 0.05, role: "skin", w: one("head"), sh: 0.86 },
  ];
  P.push(loft(torso, { seg: 12, capStart: true, seed: 11 }));

  // ----- pernas -----
  for (const [s, L] of [[-1, "L"], [1, "R"]] as const) {
    const th: Joint = `thigh${L}`, sh: Joint = `shin${L}`, ft: Joint = `foot${L}`, x = s * 0.09;
    const leg: Ring[] = [
      { y: 0.95, x, rx: 0.075, rf: 0.08, rb: 0.09, role: "shorts", w: mix("hips", th, 0.4), fx: 0.015, ff: 0.015, fb: 0.02 },
      { y: 0.84, x, rx: 0.098, rf: 0.1, rb: 0.108, role: "shorts", w: one(th), fx: 0.03, ff: 0.03, fb: 0.035 },
      { y: 0.67, x, rx: 0.094, rf: 0.097, rb: 0.1, role: "shorts", w: one(th), fx: 0.03, ff: 0.03, fb: 0.03, sh: 0.88 },
      { y: 0.67, x, rx: 0.076, rf: 0.08, rb: 0.084, role: "legs", w: one(th), fx: 0.024, ff: 0.024, fb: 0.024, sh: 0.82 },
      { y: 0.56, x, rx: 0.066, rf: 0.072, rb: 0.072, role: "legs", w: mix(th, sh, 0.05), fx: 0.018, ff: 0.018, fb: 0.018 },
      { y: 0.5, x, rx: 0.056, rf: 0.064, rb: 0.056, role: "legs", w: mix(th, sh, 0.25), fx: 0.01, ff: 0.01, fb: 0.01 },
      { y: 0.46, x, rx: 0.055, rf: 0.066, rb: 0.05, role: "legs", w: mix(th, sh, 0.5), fx: 0.008, ff: 0.008, sh: 1.06 },
      { y: 0.42, x, rx: 0.052, rf: 0.056, rb: 0.054, role: "legs", w: mix(th, sh, 0.8), fx: 0.008, ff: 0.008, fb: 0.008 },
      { y: 0.33, x, rx: 0.058, rf: 0.05, rb: 0.074, role: "legs", w: one(sh), fx: 0.012, ff: 0.008, fb: 0.014 },
      { y: 0.22, x, rx: 0.044, rf: 0.042, rb: 0.054, role: "legs", w: one(sh), fx: 0.008, ff: 0.006, fb: 0.008 },
      { y: 0.13, x, rx: 0.034, rf: 0.036, rb: 0.038, role: "white", w: one(sh), sh: 0.96 },
      { y: 0.13, x, rx: 0.037, rf: 0.039, rb: 0.041, role: "white", w: one(sh) },
      { y: 0.07, x, rx: 0.037, rf: 0.042, rb: 0.042, role: "white", w: mix(sh, ft, 0.6) },
    ];
    P.push(loft(leg, { seg: 9, seed: 20 + s }));

    // tênis: modelado ao longo do pé (calcanhar → bico)
    const shoeRing = (z: number, rx: number, up: number, down: number, cy: number, role: Role, tone = 1): Ring =>
      ({ y: z, x, z: cy, rx, rf: up, rb: down, role, w: one(ft), sh: tone });
    P.push(loft([
      shoeRing(0.085, 0.022, 0.024, 0.018, 0.056, "shoe", 0.92),
      shoeRing(0.064, 0.046, 0.052, 0.036, 0.062, "shoe"),
      shoeRing(-0.01, 0.052, 0.05, 0.036, 0.06, "shoe", 1.04),
      shoeRing(-0.09, 0.054, 0.034, 0.03, 0.05, "shoe"),
      shoeRing(-0.16, 0.047, 0.024, 0.024, 0.042, "shoe", 1.06),
      shoeRing(-0.195, 0.024, 0.012, 0.014, 0.036, "shoe"),
    ], { seg: 8, axis: "z", capStart: true, capEnd: true, seed: 30 + s, jitter: 0.008 }));
    P.push(loft([
      shoeRing(0.09, 0.03, 0.012, 0.012, 0.016, "sole"),
      shoeRing(0.066, 0.052, 0.016, 0.016, 0.016, "sole"),
      shoeRing(-0.1, 0.06, 0.016, 0.016, 0.016, "sole"),
      shoeRing(-0.2, 0.03, 0.014, 0.014, 0.02, "sole"),
    ], { seg: 8, axis: "z", capStart: true, capEnd: true, seed: 33 + s, jitter: 0.004 }));
    for (let k = 0; k < 3; k++) P.push(rigid(new B(0.062, 0.009, 0.014), ft, "white", { x, y: 0.1 - k * 0.012, z: -0.035 - k * 0.032, rx: 0.32 }));
  }

  // ----- braços -----
  for (const [s, L] of [[-1, "L"], [1, "R"]] as const) {
    const ar: Joint = `arm${L}`, fo: Joint = `fore${L}`, x = s * ARM_X;
    const arm: Ring[] = [
      { y: 1.485, x, rx: 0.026, rf: 0.03, role: "shirt", w: one(ar) },
      { y: 1.465, x, rx: 0.048, rf: 0.054, role: "shirt", w: one(ar), sh: 1.06 },
      { y: 1.42, x, rx: 0.057, rf: 0.064, role: "shirt", w: one(ar), fx: 0.012, ff: 0.012, sh: 1.04 },
      { y: 1.34, x, rx: 0.055, rf: 0.059, role: "shirt", w: one(ar), fx: 0.018, ff: 0.018 },
      { y: 1.3, x, rx: 0.054, rf: 0.057, role: "shirt", w: one(ar), fx: 0.018, ff: 0.018, sh: 0.86 },
      { y: 1.3, x, rx: 0.047, rf: 0.05, role: "sleeve", w: one(ar), fx: 0.016, ff: 0.016, sh: 0.8 },
      { y: 1.24, x, rx: 0.046, rf: 0.052, role: "sleeve", w: one(ar), fx: 0.016, ff: 0.016 },
      { y: 1.18, x, rx: 0.04, rf: 0.042, role: "sleeve", w: mix(ar, fo, 0.1), fx: 0.01, ff: 0.01 },
      { y: 1.15, x, rx: 0.039, rf: 0.038, role: "sleeve", w: mix(ar, fo, 0.5), fx: 0.006, ff: 0.006 },
      { y: 1.115, x, rx: 0.042, rf: 0.042, role: "sleeve", w: mix(ar, fo, 0.88), fx: 0.008, ff: 0.008 },
      { y: 1.06, x, rx: 0.043, rf: 0.044, role: "sleeve", w: one(fo), fx: 0.008, ff: 0.008 },
      { y: 0.98, x, rx: 0.033, rf: 0.034, role: "hand", w: one(fo), fx: 0.004, ff: 0.004 },
      { y: 0.915, x, rx: 0.025, rf: 0.031, role: "hand", w: one(fo) },
      { y: 0.885, x, rx: 0.016, rf: 0.036, role: "hand", w: one(fo) },
    ];
    P.push(loft(arm, { seg: 8, capStart: true, capEnd: true, seed: 40 + s }));
    // mão: palma e dedos
    P.push(rigid(new B(0.028, 0.075, 0.072), fo, "hand", { x, y: 0.865 }));
    for (let k = 0; k < 4; k++) {
      const z = -0.027 + k * 0.018, len = k === 0 || k === 3 ? 0.052 : 0.064;
      P.push(rigid(new B(0.017, len, 0.0155), fo, "hand", { x: x - s * 0.006, y: 0.83 - len / 2, z, rz: s * 0.16, sh: 0.97 }));
    }
    P.push(rigid(new B(0.019, 0.055, 0.018), fo, "hand", { x: x - s * 0.012, y: 0.86, z: -0.05, rx: 0.5, rz: s * 0.2 }));
  }
  // sensor de glicose (CGM) atrás do braço esquerdo
  P.push(rigid(new Cy(0.03, 0.03, 0.012, 10), "armL", "white", { x: -ARM_X, y: 1.245, z: 0.056, rx: Math.PI / 2, fat: [0, 0, 0.016] }));

  // ----- cabeça -----
  const H = one("head");
  P.push(loft([
    { y: 1.533, rx: 0.034, rf: 0.04, rb: 0.03, z: -0.03, role: "skin", w: H, sh: 0.92 },
    { y: 1.56, rx: 0.066, rf: 0.082, rb: 0.058, z: -0.012, role: "skin", w: H, sh: 0.96 },
    { y: 1.6, rx: 0.088, rf: 0.1, rb: 0.09, z: -0.005, role: "skin", w: H },
    { y: 1.65, rx: 0.096, rf: 0.108, rb: 0.104, role: "skin", w: H, sh: 1.04 },
    { y: 1.7, rx: 0.094, rf: 0.102, rb: 0.106, role: "skin", w: H, sh: 1.04 },
    { y: 1.74, rx: 0.07, rf: 0.08, rb: 0.084, role: "skin", w: H },
    { y: 1.757, rx: 0.03, rf: 0.03, role: "skin", w: H },
  ], { seg: 10, capStart: true, capEnd: true, seed: 3, jitter: 0.01 }));
  const [hairDark, hairLight] = hair();
  P.push(rigid(hairDark, "head", "hair"), rigid(hairLight, "head", "hairLight"));
  for (const [x, z, rz, rx, role] of [[-0.055, -0.108, -0.35, 0.22, "hair"], [0.0, -0.122, 0.1, 0.25, "hairLight"], [0.058, -0.106, 0.4, 0.22, "hair"]] as const) {
    P.push(rigid(new Co(0.036, 0.06, 4), "head", role, { x, y: 1.74, z: z * 0.92, rx: Math.PI + rx, rz, skin: "!medico" })); // some sob a touca
  }
  for (const s of [-1, 1]) {
    P.push(rigid(new S(0.026, 6, 5), "head", "skin", { x: s * 0.097, y: 1.64, sx: 0.55, sy: 1.15, sh: 0.94 }));
    P.push(rigid(new S(0.012, 7, 5), "head", "dark", { x: s * 0.04, y: 1.652, z: -0.101, sx: 1.3, sz: 0.5 }));
    P.push(rigid(new B(0.042, 0.009, 0.012), "head", "hair", { x: s * 0.04, y: 1.682, z: -0.104, rz: s * -0.1 }));
  }
  P.push(rigid(new Co(0.017, 0.05, 4), "head", "skin", { y: 1.625, z: -0.112, rx: -Math.PI / 2 - 0.5, sh: 1.05 }));
  P.push(rigid(new B(0.042, 0.007, 0.01), "head", 0x6b3a2e, { y: 1.585, z: -0.09 }));

  // ----- acessórios de cada visual -----
  // Corredor: faixa de cabeça
  P.push(rigid(new To(1, 0.13, 5, 18), "head", 0xff4f8b, { y: 1.7, rx: Math.PI / 2, sx: 0.116, sy: 0.128, sz: 0.1, skin: "corredor" }));
  P.push(rigid(new B(0.028, 0.1, 0.01), "head", 0xff4f8b, { x: 0.02, y: 1.665, z: 0.128, rx: 0.3, rz: 0.3, skin: "corredor" }));
  // Fone de ouvido
  P.push(rigid(new To(0.126, 0.014, 5, 16, Math.PI), "head", 0x2b2250, { y: 1.655, skin: "fone" }));
  for (const s of [-1, 1]) {
    P.push(rigid(new Cy(0.05, 0.05, 0.036, 10), "head", 0x5a43c8, { x: s * 0.116, y: 1.645, rz: Math.PI / 2, skin: "fone" }));
    P.push(rigid(new Cy(0.034, 0.034, 0.04, 8), "head", 0x2b2250, { x: s * 0.122, y: 1.645, rz: Math.PI / 2, skin: "fone" }));
  }
  // Mochila de hidratação nas costas (+z, visível para a câmera)
  const back = (d: number): [number, number, number] => [0, 0, d];
  P.push(rigid(new B(0.27, 0.34, 0.1), "torso", 0x18a37a, { y: 1.3, z: 0.178, fat: back(0.04), skin: "mochila" }));
  P.push(rigid(new B(0.17, 0.19, 0.02), "torso", 0x7fd0ff, { y: 1.315, z: 0.234, fat: back(0.04), skin: "mochila" }));
  P.push(rigid(new B(0.27, 0.05, 0.11), "torso", 0x0f7d5e, { y: 1.15, z: 0.18, fat: back(0.04), skin: "mochila" }));
  P.push(rigid(new To(0.09, 0.008, 4, 10, Math.PI), "torso", 0x2b6f8f, { x: 0.13, y: 1.42, z: 0.14, ry: Math.PI / 2, fat: back(0.03), skin: "mochila" }));
  for (const s of [-1, 1]) {
    P.push(rigid(new B(0.036, 0.3, 0.018), "torso", 0x0f5e47, { x: s * 0.095, y: 1.33, z: -0.127, fat: back(-0.05), skin: "mochila" }));
    P.push(rigid(new B(0.036, 0.018, 0.24), "torso", 0x0f5e47, { x: s * 0.095, y: 1.468, skin: "mochila" }));
  }
  // ACS: colete (cor do tronco), boné e bolsa de visita a tiracolo
  P.push(rigid(new S(0.117, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), "head", 0x1f5fa8, { y: 1.682, sz: 1.08, skin: "acs" }));
  P.push(rigid(new B(0.16, 0.012, 0.11), "head", 0x174a85, { y: 1.69, z: -0.15, rx: 0.12, skin: "acs" }));
  P.push(rigid(new B(0.065, 0.17, 0.21), "hips", 0x8a5a3b, { x: -0.215, y: 0.98, fat: [-0.05, 0, 0], skin: "acs" }));
  P.push(rigid(new B(0.07, 0.05, 0.215), "hips", 0x6f4730, { x: -0.215, y: 1.04, fat: [-0.05, 0, 0], skin: "acs" }));
  P.push(rigid(new B(0.024, 0.6, 0.012), "torso", 0x8a5a3b, { y: 1.26, z: 0.122, rz: 0.62, fat: back(0.04), skin: "acs" }));
  P.push(rigid(new B(0.024, 0.6, 0.012), "torso", 0x8a5a3b, { y: 1.26, z: -0.128, rz: 0.62, fat: back(-0.07), skin: "acs" }));
  // ----- Doutor(a): jaleco longo e aberto, mangas compridas, máscara, luvas, touca e estetoscópio -----
  const COAT = 0xf7f8f6, LINING = 0xdfe5e6, SCRUB = 0x2f8f9d, TUBE = 0x22303f, MASK = 0x9fd3e8;
  const md = { skin: "medico" } as const;
  const front = (d: number) => back(d); // peças na frente acompanham a barriga ao engordar
  P.push(coatSkirt(COAT, false), coatSkirt(LINING, true));
  // pijama aparecendo na abertura do jaleco
  P.push(rigid(new B(0.085, 0.2, 0.012), "torso", SCRUB, { y: 1.36, z: -0.124, fat: front(-0.05), ...md }));
  P.push(rigid(new B(0.075, 0.22, 0.012), "torso", SCRUB, { y: 1.15, z: -0.106, rx: -0.08, fat: front(-0.07), ...md }));
  for (const s of [-1, 1]) {
    // lapelas largas: gola no alto, ponta e a borda que desce até a cintura
    P.push(rigid(new B(0.075, 0.16, 0.016), "torso", COAT, { x: s * 0.075, y: 1.405, z: -0.128, rz: s * 0.42, rx: -0.12, fat: front(-0.05), sh: 1.04, ...md }));
    P.push(rigid(new B(0.05, 0.08, 0.016), "torso", COAT, { x: s * 0.098, y: 1.31, z: -0.132, rz: -s * 0.5, fat: front(-0.05), sh: 1.06, ...md }));
    P.push(rigid(new B(0.03, 0.26, 0.016), "torso", COAT, { x: s * 0.058, y: 1.16, z: -0.112, rx: -0.08, fat: front(-0.07), sh: 1.02, ...md }));
    P.push(rigid(new B(0.05, 0.05, 0.06), "torso", COAT, { x: s * 0.07, y: 1.47, z: -0.07, rz: s * 0.5, ...md })); // gola
    // manga comprida: o braço já é da cor do jaleco; aqui só o punho
    const fo: Joint = s < 0 ? "foreL" : "foreR", x = s * ARM_X;
    P.push(rigid(new Cy(0.05, 0.05, 0.03, 8), fo, LINING, { x, y: 1.0, ...md })); // punho
    // bolsos na aba
    const th = Math.PI - 0.95, r = 0.232;
    P.push(rigid(new B(0.1, 0.1, 0.008), "hips", 0xeef1f1, { x: s * Math.sin(th) * r, y: 0.83, z: Math.cos(th) * r * 0.8, ry: s * (th - Math.PI), ...md }));
    P.push(rigid(new B(0.11, 0.018, 0.01), "hips", LINING, { x: s * Math.sin(th) * (r + 0.004), y: 0.885, z: Math.cos(th) * (r + 0.004) * 0.8, ry: s * (th - Math.PI), ...md }));
    // elástico da máscara até a orelha
    P.push(rigid(new B(0.006, 0.006, 0.1), "head", 0xf4f6f8, { x: s * 0.097, y: 1.618, z: -0.045, rx: -0.15, ...md }));
  }
  for (let k = 0; k < 3; k++) P.push(rigid(new S(0.009, 6, 4), "torso", 0xd5dadb, { x: -0.05, y: 1.23 - k * 0.075, z: -0.125 + k * 0.006, ...md }));
  // bolso do peito com caneta e crachá
  P.push(rigid(new B(0.075, 0.075, 0.01), "torso", 0xeef1f1, { x: -0.105, y: 1.27, z: -0.122, fat: front(-0.05), ...md }));
  P.push(rigid(new B(0.008, 0.07, 0.008), "torso", 0x2f7fe0, { x: -0.12, y: 1.3, z: -0.13, fat: front(-0.05), ...md }));
  P.push(rigid(new B(0.06, 0.075, 0.008), "torso", 0x2f7fe0, { x: 0.105, y: 1.27, z: -0.125, fat: front(-0.05), ...md }));
  P.push(rigid(new B(0.05, 0.035, 0.01), "torso", 0xffffff, { x: 0.105, y: 1.275, z: -0.129, fat: front(-0.05), ...md }));
  // máscara cirúrgica com pregas, cobrindo nariz e boca
  P.push(rigid(new S(0.075, 12, 8), "head", MASK, { y: 1.598, z: -0.078, sx: 1.38, sy: 0.6, sz: 0.88, ...md }));
  for (let k = 0; k < 3; k++) P.push(rigid(new B(0.17, 0.004, 0.006), "head", 0x86c2db, { y: 1.575 + k * 0.022, z: -0.14 + Math.abs(k - 1) * 0.004, ...md }));
  // touca cirúrgica
  P.push(rigid(new S(0.136, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), "head", SCRUB, { y: 1.672, sz: 1.06, ...md }));
  P.push(rigid(new B(0.03, 0.06, 0.012), "head", SCRUB, { x: 0.03, y: 1.64, z: 0.13, rz: 0.3, ...md }));
  // estetoscópio pendurado no pescoço, com o disco no peito
  P.push(rigid(new To(0.11, 0.011, 5, 18), "torso", TUBE, { y: 1.47, rx: Math.PI / 2 - 0.25, sx: 1.05, ...md }));
  for (const s of [-1, 1]) P.push(rigid(new Cy(0.01, 0.01, 0.17, 5), "torso", TUBE, { x: s * 0.05, y: 1.37, z: -0.136, rz: s * 0.16, fat: front(-0.05), ...md }));
  P.push(rigid(new Cy(0.03, 0.03, 0.014, 10), "torso", 0xc9ced6, { x: 0.045, y: 1.28, z: -0.142, rx: Math.PI / 2, fat: front(-0.05), ...md }));
  return P;
}

const MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

export class Character {
  readonly root = new THREE.Group();
  private j = {} as Record<Joint, THREE.Bone>;
  private skeleton: THREE.Skeleton;
  private parts = buildParts();
  private mesh: THREE.SkinnedMesh | null = null;
  private tinted: { i: number; base: THREE.Color }[] = [];
  private shade: Float32Array = new Float32Array(0);
  private skin: SkinId = "corredor";
  private shirtTint = -1;
  private label: THREE.Mesh;
  private coatLabel: THREE.Mesh;
  private shoulders: THREE.Bone[] = [];
  private hipJoints: THREE.Bone[] = [];
  private pose: Pose = { ...STAND };
  private target: Pose = { ...STAND };
  private phase = 0;
  private hitT = 0;
  private cheerT = 0;
  private flipT = 0;
  private time = 0;
  private fatNow = 0.85;

  constructor() {
    this.buildSkeleton();
    this.root.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(JOINTS.map((n) => this.j[n]));
    // rótulo "ACS" nas costas do colete (textura, malha à parte)
    this.label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.08),
      new THREE.MeshBasicMaterial({ map: textTexture("ACS", { w: 128, h: 48, fg: "#ffffff" }), transparent: true }),
    );
    this.label.position.set(0, 0.34, 0.124);
    this.j.torso.add(this.label);
    // "MEDICINA" nas costas do jaleco
    this.coatLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.07),
      new THREE.MeshBasicMaterial({ map: textTexture("MEDICINA", { w: 192, h: 56, fg: "#1f6f7a" }), transparent: true }),
    );
    this.coatLabel.position.set(0, 0.33, 0.124);
    this.j.torso.add(this.coatLabel);
    this.setSkin("corredor");
    this.setFat(this.fatNow);
  }

  private bone(name: Joint, parent: THREE.Object3D, x: number, y: number): THREE.Bone {
    const b = new THREE.Bone();
    b.position.set(x, y, 0);
    parent.add(b);
    this.j[name] = b;
    return b;
  }

  private buildSkeleton(): void {
    const hips = this.bone("hips", this.root, 0, HIP_Y);
    for (const [s, L] of [[-1, "L"], [1, "R"]] as const) {
      const thigh = this.bone(`thigh${L}`, hips, s * 0.09, -0.05);
      this.hipJoints.push(thigh);
      const shin = this.bone(`shin${L}`, thigh, 0, -0.44);
      this.bone(`foot${L}`, shin, 0, -0.42);
    }
    const torso = this.bone("torso", hips, 0, 0.06);
    this.bone("head", torso, 0, 0.6);
    for (const [s, L] of [[-1, "L"], [1, "R"]] as const) {
      const arm = this.bone(`arm${L}`, torso, s * ARM_X, 0.42);
      this.shoulders.push(arm);
      this.bone(`fore${L}`, arm, 0, -0.28);
    }
  }

  private color(role: Role, out: THREE.Color): THREE.Color {
    if (typeof role === "number") return out.setHex(role);
    const o = OUTFIT[this.skin];
    const map: Record<Exclude<Role, number>, number> = {
      skin: SKIN_TONE, hand: o.hand ?? SKIN_TONE, sleeve: o.sleeve ?? SKIN_TONE, hair: 0x2b1b1e, hairLight: 0x6a4630, shirt: o.shirt, vest: o.vest ?? o.shirt, shorts: o.shorts, band: o.band,
      shoe: o.shoe, sole: o.sole, legs: o.legs ?? SKIN_TONE, white: 0xf4f6f8, dark: 0x1b1b1f,
    };
    return out.setHex(map[role]);
  }

  setSkin(skin: SkinId): void {
    this.skin = skin;
    this.label.visible = skin === "acs";
    this.coatLabel.visible = skin === "medico";
    if (this.mesh) { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); }
    const { geo, roles, shade } = assemble(this.parts.filter((p) => !p.skin || p.skin === skin || (p.skin[0] === "!" && p.skin.slice(1) !== skin)), (r, c) => this.color(r, c));
    this.shade = shade;
    const shirt = this.color("shirt", new THREE.Color()), vest = this.color("vest", new THREE.Color());
    this.tinted = [];
    roles.forEach((r, i) => { if (r === "shirt" || r === "vest") this.tinted.push({ i, base: r === "shirt" ? shirt : vest }); });
    const mesh = new THREE.SkinnedMesh(geo, MAT);
    mesh.frustumCulled = false;
    this.root.add(mesh);
    mesh.bind(this.skeleton, new THREE.Matrix4());
    this.mesh = mesh;
    this.shirtTint = -1;
    this.setFat(this.fatNow);
  }

  /** fat: 0 = bem condicionado, 1 = sedentário. O corpo muda de forma suave. */
  setFat(fat: number): void {
    this.fatNow = fat;
    if (this.mesh?.morphTargetInfluences) this.mesh.morphTargetInfluences[0] = fat;
    this.shoulders.forEach((s, i) => (s.position.x = (i ? 1 : -1) * ARM_X * (1 + 0.16 * fat)));
    this.hipJoints.forEach((h, i) => (h.position.x = (i ? 1 : -1) * 0.09 * (1 + 0.22 * fat)));
    this.label.position.z = 0.124 + 0.036 * fat;
    this.coatLabel.position.z = 0.124 + 0.036 * fat;
  }

  /** Camisa avermelhada na hiperglicemia (como no original). Só reescreve as cores quando mudam. */
  private tintShirt(amount: number): void {
    const q = Math.round(amount * 20) / 20;
    if (q === this.shirtTint || !this.mesh) return;
    this.shirtTint = q;
    const col = this.mesh.geometry.attributes.color as THREE.BufferAttribute;
    const c = new THREE.Color();
    for (const { i, base } of this.tinted) {
      c.copy(base).lerp(HYPER_SHIRT, q).multiplyScalar(this.shade[i]);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  /** Reações curtas por cima do movimento. */
  hit(): void { this.hitT = 0.55; }
  cheer(): void { this.cheerT = 1.3; }
  flip(): void { this.flipT = 0.55; }

  private hyperAmt = 0;

  update(dt: number, a: AnimInput): void {
    this.time += dt;
    const t = this.time;
    const T = this.target;
    Object.assign(T, STAND);

    if (a.motion === "run") {
      const cadence = (6.5 + a.speed * 0.2) * (a.hyper ? 0.82 : 1);
      this.phase += dt * cadence;
      const s = Math.sin(this.phase), c = Math.cos(this.phase);
      T.thighL = 0.72 * s; T.thighR = -0.72 * s;
      T.shinL = -0.2 - 1.15 * Math.max(0, c); T.shinR = -0.2 - 1.15 * Math.max(0, -c);
      T.footL = 0.35 * Math.max(0, -s); T.footR = 0.35 * Math.max(0, s);
      T.armLx = -0.6 * s; T.armRx = 0.6 * s;
      T.foreL = 1.35 + 0.2 * s; T.foreR = 1.35 - 0.2 * s;
      T.torsoRx = a.hyper ? -0.3 : -0.17; T.torsoRy = 0.12 * s;
      T.headRx = a.hyper ? 0.2 : 0.1;
      T.hipY = HIP_Y - 0.03 + 0.05 * Math.abs(c);
    } else if (a.motion === "jump") {
      T.thighL = 1.0; T.shinL = -1.5; T.thighR = -0.15; T.shinR = -0.7; T.footR = 0.4;
      T.armLx = 0.4; T.armRx = 2.3; T.armLz = -0.5; T.armRz = 0.3; T.foreL = 0.6; T.foreR = 0.4;
      T.torsoRx = -0.1; T.headRx = -0.1;
    } else if (a.motion === "fall") {
      T.thighL = 0.55; T.shinL = -0.7; T.thighR = 0.2; T.shinR = -0.5;
      T.armLx = 0.5; T.armRx = 0.5; T.armLz = -0.95; T.armRz = 0.95; T.foreL = 0.5; T.foreR = 0.5;
      T.torsoRx = -0.05;
    } else if (a.motion === "slide") {
      T.hipY = 0.28; T.hipsRx = 1.1; T.torsoRx = -0.5; T.headRx = -0.35;
      T.thighL = 0.42; T.shinL = -0.05; T.thighR = 0.3; T.shinR = -0.75;
      T.armLx = -0.9; T.armRx = 0.5; T.armLz = -0.35; T.armRz = 0.4; T.foreL = 0.2; T.foreR = 0.9;
    } else if (a.motion === "tired") {
      const br = Math.sin(t * 3.2);
      T.hipY = HIP_Y - 0.08; T.torsoRx = -0.75 + br * 0.04; T.headRx = 0.35;
      T.thighL = 0.35; T.thighR = 0.35; T.shinL = -0.55; T.shinR = -0.55; T.footL = 0.2; T.footR = 0.2;
      T.thighLz = -0.08; T.thighRz = 0.08;
      T.armLx = 0.95; T.armRx = 0.95; T.foreL = 0.25; T.foreR = 0.25; T.armLz = -0.15; T.armRz = 0.15;
    } else {
      // parado, respirando
      const br = Math.sin(t * 2);
      T.torsoRx = 0.02 * br; T.armLz = -0.12 - 0.03 * br; T.armRz = 0.12 + 0.03 * br; T.headRx = -0.03;
    }

    // inclinação ao trocar de faixa
    T.torsoRz = -a.lean * 0.25;

    // reações por cima da pose base
    if (this.cheerT > 0) {
      this.cheerT -= dt;
      const w = Math.max(0, Math.min(1, this.cheerT * 4, (1.3 - this.cheerT) * 6));
      const wave = Math.sin(t * 14) * 0.15;
      T.armLx += (2.9 - T.armLx) * w; T.armRx += (2.9 - T.armRx) * w;
      T.armLz += (-0.45 + wave - T.armLz) * w; T.armRz += (0.45 - wave - T.armRz) * w;
      T.foreL += (0.25 - T.foreL) * w; T.foreR += (0.25 - T.foreR) * w;
      T.headRx += (-0.25 - T.headRx) * w;
    }
    if (this.hitT > 0) {
      this.hitT -= dt;
      const w = Math.sin(Math.max(0, Math.min(1, this.hitT / 0.55)) * Math.PI);
      T.torsoRx += 0.65 * w; T.headRx += 0.45 * w;
      T.armLz -= 1.2 * w; T.armRz += 1.2 * w; T.armLx += 0.6 * w; T.armRx -= 0.3 * w;
    }

    // transição suave entre poses
    const k = 1 - Math.exp(-dt * (a.motion === "run" ? 22 : 13));
    const P = this.pose as unknown as Record<string, number>, TT = T as unknown as Record<string, number>;
    for (const key of KEYS) P[key] += (TT[key] - P[key]) * k;

    // aplica nos ossos
    const p = this.pose, J = this.j;
    let flip = 0;
    if (this.flipT > 0) {
      this.flipT = Math.max(0, this.flipT - dt);
      const u = 1 - this.flipT / 0.55;
      flip = -Math.PI * 2 * (1 - (1 - u) * (1 - u)); // cambalhota no pulo duplo
    }
    J.hips.position.y = p.hipY;
    J.hips.rotation.set(p.hipsRx + flip, 0, 0);
    J.torso.rotation.set(p.torsoRx, p.torsoRy, p.torsoRz);
    J.head.rotation.x = p.headRx;
    J.armL.rotation.set(p.armLx, 0, p.armLz);
    J.armR.rotation.set(p.armRx, 0, p.armRz);
    J.foreL.rotation.x = p.foreL;
    J.foreR.rotation.x = p.foreR;
    J.thighL.rotation.set(p.thighL, 0, p.thighLz);
    J.thighR.rotation.set(p.thighR, 0, p.thighRz);
    J.shinL.rotation.x = p.shinL;
    J.shinR.rotation.x = p.shinR;
    J.footL.rotation.x = p.footL;
    J.footR.rotation.x = p.footR;
    this.root.rotation.set(0, a.lean * 0.3, -a.lean * 0.18);
    // tremor da hipoglicemia
    this.root.position.x = a.hypo ? (Math.random() - 0.5) * 0.035 : 0;

    this.hyperAmt += ((a.hyper ? 0.75 : 0) - this.hyperAmt) * Math.min(1, dt * 3);
    this.tintShirt(this.hyperAmt);
  }
}
