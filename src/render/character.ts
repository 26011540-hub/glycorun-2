import * as THREE from "three";
import type { SkinId } from "../content/texts";
import { seeded, textTexture } from "./builder";
import { assemble, JOINTS, loft, rigid, smoothRings, tube, type Joint, type Part, type Ring, type Role, type Weights } from "./body";

/**
 * Personagem original do GlycoRun 2: corpo liso e contínuo gerado em código (ver body.ts), com esqueleto real.
 * Estilo levemente caricato: magro, pernas e braços longos, nariz grande, cabelo em mechas.
 * Ele corre para -z (de costas para a câmera).
 * Engordar e emagrecer é uma deformação suave do próprio corpo (decisão do autor).
 * Tudo vira uma malha só: 1 chamada de desenho para o personagem inteiro (+1 para o letreiro do ACS).
 * A versão de peças separadas está guardada em character-v1.ts.
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
const ARM_X = 0.178;
const LEG_X = 0.078;
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
const SKIN_TONE = 0xa8734f;
interface Outfit { shirt: number; vest?: number; shorts: number; band: number; shoe: number; sole: number; legs?: number }
const OUTFIT: Record<SkinId, Outfit> = {
  corredor: { shirt: 0x2f7fe0, shorts: 0x22324a, band: 0xf4f6f8, shoe: 0xb6ff3b, sole: 0xff4f8b },
  fone: { shirt: 0x6f55e0, shorts: 0x2a2f45, band: 0xc9bff5, shoe: 0xf4f4f4, sole: 0x6f55e0 },
  mochila: { shirt: 0xf08a3c, shorts: 0x22324a, band: 0xf4f6f8, shoe: 0xf4f4f4, sole: 0xe2483d },
  acs: { shirt: 0xe9f1fa, vest: 0x1f5fa8, shorts: 0x3a4a63, band: 0x2c394e, shoe: 0x2e2a28, sole: 0x111111, legs: 0x3a4a63 },
};
const HYPER_SHIRT = new THREE.Color(0xe46a4f);

const one = (j: Joint): Weights => [[j, 1]];
const mix = (a: Joint, b: Joint, t: number): Weights => [[a, 1 - t], [b, t]];
type V3 = [number, number, number];

/** Cabelo curto e bagunçado: calota lisa + mechas curtas deitadas sobre a cabeça. */
function hairParts(): Part[] {
  const out: Part[] = [];
  out.push(rigid(new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), "head", "hair", { y: 1.694, z: 0.014, rx: 0.42, sx: 0.0975, sy: 0.108, sz: 0.122 }));
  const rnd = seeded(77);
  const C = new THREE.Vector3(0, 1.69, 0.01);
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 74; i++) {
    const az = rnd() * Math.PI * 2, p = Math.acos(1 - rnd() * 1.25);
    const d = new THREE.Vector3(Math.sin(p) * Math.cos(az), Math.cos(p), Math.sin(p) * Math.sin(az));
    if (d.z < -0.3 && d.y < 0.72) continue; // deixa a testa e o rosto livres
    const surf = (v: THREE.Vector3) => C.clone().add(new THREE.Vector3(v.x * 0.101, v.y * 0.112, v.z * 0.124));
    // direção da mecha: desce a partir do topo, com variação
    const flow = up.clone().multiplyScalar(-1).addScaledVector(d, d.y).add(new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).multiplyScalar(0.7));
    if (flow.lengthSq() < 0.01) flow.set(rnd() - 0.5, 0, rnd() - 0.5);
    flow.normalize();
    const len = 0.5 + rnd() * 0.32; // comprimento em ângulo sobre a cabeça
    const d1 = d.clone().addScaledVector(flow, len * 0.5).normalize();
    const d2 = d.clone().addScaledVector(flow, len).normalize();
    const lift = 1.02 + rnd() * 0.06;
    const p0 = surf(d).multiplyScalar(1).toArray() as V3;
    const p1 = C.clone().add(surf(d1).sub(C).multiplyScalar(1.09)).toArray() as V3;
    const p2 = C.clone().add(surf(d2).sub(C).multiplyScalar(lift + 0.05)).toArray() as V3;
    const r = 0.021 + rnd() * 0.01;
    out.push(tube([p0, p1, p2], [r * 0.9, r, 0.0025], "head", rnd() < 0.24 ? "hairLight" : "hair", { seg: 6, sub: 1, flat: 0.62 }));
  }
  // franja curta, jogada para o lado
  for (const [x, l] of [[-0.062, 0.03], [-0.03, 0.04], [0.002, 0.044], [0.036, 0.036], [0.066, 0.026]] as const) {
    out.push(tube([[x * 0.7, 1.778, -0.07], [x, 1.771, -0.108], [x + 0.014, 1.771 - l * 0.6, -0.122], [x + 0.028, 1.771 - l, -0.116]], [0.021, 0.02, 0.012, 0.0025], "head", x > 0.03 ? "hairLight" : "hair", { seg: 6, sub: 1, flat: 0.55 }));
  }
  return out;
}

function buildParts(): Part[] {
  const S = THREE.SphereGeometry, B = THREE.BoxGeometry, Cy = THREE.CylinderGeometry, To = THREE.TorusGeometry;
  const P: Part[] = [];
  const hipsW = one("hips"), torsoW = one("torso");

  // ----- tronco, do quadril ao pescoço (magro, ombros mais largos que a cintura) -----
  const T: Role = "vest"; // o tronco usa a cor do colete; sem colete, é a própria camiseta
  P.push(loft(smoothRings([
    { y: 0.79, rx: 0.03, rf: 0.04, role: "shorts", w: hipsW, sh: 0.8 },
    { y: 0.83, rx: 0.105, rf: 0.085, rb: 0.09, role: "shorts", w: hipsW, sh: 0.86 },
    { y: 0.89, rx: 0.132, rf: 0.09, rb: 0.106, role: "shorts", w: hipsW, fx: 0.03, ff: 0.02, fb: 0.03, sh: 0.94 },
    { y: 0.96, rx: 0.14, rf: 0.09, rb: 0.112, role: "shorts", w: hipsW, fx: 0.05, ff: 0.035, fb: 0.05 },
    { y: 1.01, rx: 0.13, rf: 0.086, rb: 0.1, role: "band", w: mix("hips", "torso", 0.2), fx: 0.07, ff: 0.07, fb: 0.05 },
    { y: 1.04, rx: 0.126, rf: 0.084, rb: 0.096, role: T, w: mix("hips", "torso", 0.35), fx: 0.075, ff: 0.08, fb: 0.05, sh: 0.76 },
    { y: 1.04, rx: 0.138, rf: 0.096, rb: 0.106, role: T, w: mix("hips", "torso", 0.35), fx: 0.075, ff: 0.08, fb: 0.05, sh: 0.9 },
    { y: 1.13, rx: 0.122, rf: 0.086, rb: 0.086, role: T, w: mix("hips", "torso", 0.8), fx: 0.085, ff: 0.125, fb: 0.05, sh: 0.97 },
    { y: 1.22, rx: 0.132, rf: 0.094, rb: 0.09, role: T, w: torsoW, fx: 0.075, ff: 0.11, fb: 0.05, spine: 0.1, sca: 0.04 },
    { y: 1.32, rx: 0.16, rf: 0.104, rb: 0.098, role: T, w: torsoW, fx: 0.055, ff: 0.06, fb: 0.04, pec: 0.14, spine: 0.12, sca: 0.1, sh: 1.03 },
    { y: 1.395, rx: 0.17, rf: 0.098, rb: 0.098, role: T, w: torsoW, fx: 0.05, ff: 0.03, fb: 0.03, pec: 0.1, spine: 0.08, sca: 0.14, sh: 1.05 },
    { y: 1.445, rx: 0.164, rf: 0.072, rb: 0.08, role: "shirt", w: torsoW, fx: 0.05, ff: 0.015, fb: 0.02 },
    { y: 1.478, rx: 0.106, rf: 0.058, rb: 0.066, role: "shirt", w: torsoW, fx: 0.02, ff: 0.012, fb: 0.015, sh: 1.03 },
    { y: 1.497, rx: 0.056, rf: 0.05, rb: 0.056, role: "shirt", w: torsoW, fx: 0.01, ff: 0.01, sh: 0.82 },
    { y: 1.497, rx: 0.044, rf: 0.041, rb: 0.047, role: "skin", w: torsoW, fx: 0.01, ff: 0.01, sh: 0.76 },
    { y: 1.53, rx: 0.039, rf: 0.04, rb: 0.043, z: -0.004, role: "skin", w: mix("torso", "head", 0.35), fx: 0.008, ff: 0.008, sh: 0.86 },
    { y: 1.6, rx: 0.038, rf: 0.04, rb: 0.042, z: -0.008, role: "skin", w: one("head"), sh: 0.82 },
  ], 2), { seg: 20, capStart: true }));

  // ----- pernas longas -----
  for (const [s, L] of [[-1, "L"], [1, "R"]] as const) {
    const th: Joint = `thigh${L}`, sh: Joint = `shin${L}`, ft: Joint = `foot${L}`, x = s * LEG_X;
    const shortsLeg = loft(smoothRings([
      { y: 0.95, x, rx: 0.066, rf: 0.072, rb: 0.082, role: "shorts", w: mix("hips", th, 0.4), fx: 0.015, ff: 0.015, fb: 0.02 },
      { y: 0.84, x, rx: 0.088, rf: 0.09, rb: 0.098, role: "shorts", w: one(th), fx: 0.034, ff: 0.03, fb: 0.036 },
      { y: 0.67, x, rx: 0.088, rf: 0.09, rb: 0.092, role: "shorts", w: one(th), fx: 0.034, ff: 0.03, fb: 0.032, sh: 0.86 },
      { y: 0.67, x, rx: 0.064, rf: 0.07, rb: 0.072, role: "legs", w: one(th), fx: 0.028, ff: 0.026, fb: 0.026, sh: 0.78 },
      { y: 0.56, x, rx: 0.056, rf: 0.064, rb: 0.06, role: "legs", w: mix(th, sh, 0.05), fx: 0.02, ff: 0.02, fb: 0.02 },
      { y: 0.5, x, rx: 0.046, rf: 0.052, rb: 0.047, role: "legs", w: mix(th, sh, 0.25), fx: 0.012, ff: 0.012, fb: 0.012 },
      { y: 0.46, x, rx: 0.044, rf: 0.056, rb: 0.04, role: "legs", w: mix(th, sh, 0.5), fx: 0.009, ff: 0.009, sh: 1.05 },
      { y: 0.42, x, rx: 0.041, rf: 0.045, rb: 0.044, role: "legs", w: mix(th, sh, 0.8), fx: 0.009, ff: 0.009, fb: 0.009 },
      { y: 0.33, x, rx: 0.047, rf: 0.04, rb: 0.064, role: "legs", w: one(sh), fx: 0.013, ff: 0.008, fb: 0.015 },
      { y: 0.22, x, rx: 0.036, rf: 0.034, rb: 0.044, role: "legs", w: one(sh), fx: 0.008, ff: 0.006, fb: 0.008 },
      { y: 0.13, x, rx: 0.027, rf: 0.029, rb: 0.031, role: "white", w: one(sh), sh: 0.92 },
      { y: 0.13, x, rx: 0.031, rf: 0.033, rb: 0.035, role: "white", w: one(sh) },
      { y: 0.07, x, rx: 0.031, rf: 0.036, rb: 0.036, role: "white", w: mix(sh, ft, 0.6) },
    ], 2), { seg: 14 });
    shortsLeg.not = "acs";
    P.push(shortsLeg);
    P.push(loft(smoothRings([
      { y: 0.95, x, rx: 0.066, rf: 0.072, rb: 0.082, role: "shorts", w: mix("hips", th, 0.4), fx: 0.015, ff: 0.015, fb: 0.02 },
      { y: 0.84, x, rx: 0.082, rf: 0.086, rb: 0.094, role: "shorts", w: one(th), fx: 0.034, ff: 0.03, fb: 0.036 },
      { y: 0.67, x, rx: 0.07, rf: 0.076, rb: 0.078, role: "legs", w: one(th), fx: 0.028, ff: 0.026, fb: 0.026 },
      { y: 0.5, x, rx: 0.056, rf: 0.062, rb: 0.058, role: "legs", w: mix(th, sh, 0.25), fx: 0.012, ff: 0.012, fb: 0.012 },
      { y: 0.46, x, rx: 0.054, rf: 0.062, rb: 0.052, role: "legs", w: mix(th, sh, 0.5), fx: 0.009, ff: 0.009 },
      { y: 0.42, x, rx: 0.052, rf: 0.056, rb: 0.056, role: "legs", w: mix(th, sh, 0.8), fx: 0.009, ff: 0.009, fb: 0.009 },
      { y: 0.3, x, rx: 0.052, rf: 0.052, rb: 0.062, role: "legs", w: one(sh), fx: 0.013, ff: 0.008, fb: 0.015 },
      { y: 0.13, x, rx: 0.05, rf: 0.052, rb: 0.054, role: "legs", w: one(sh), sh: 0.92 },
      { y: 0.07, x, rx: 0.05, rf: 0.056, rb: 0.056, role: "legs", w: mix(sh, ft, 0.6), sh: 0.85 },
    ], 2), { seg: 14, skin: "acs" }));

    // tênis: modelado ao longo do pé (calcanhar → bico)
    const shoeRing = (z: number, rx: number, up: number, down: number, cy: number, role: Role, tone = 1): Ring =>
      ({ y: z, x, z: cy, rx, rf: up, rb: down, role, w: one(ft), sh: tone });
    P.push(loft(smoothRings([
      shoeRing(0.085, 0.02, 0.022, 0.016, 0.056, "shoe", 0.92),
      shoeRing(0.064, 0.042, 0.05, 0.034, 0.062, "shoe"),
      shoeRing(-0.01, 0.047, 0.05, 0.034, 0.06, "shoe", 1.03),
      shoeRing(-0.09, 0.05, 0.032, 0.03, 0.05, "shoe"),
      shoeRing(-0.16, 0.044, 0.024, 0.024, 0.042, "shoe", 1.05),
      shoeRing(-0.2, 0.02, 0.01, 0.012, 0.036, "shoe"),
    ], 2), { seg: 12, axis: "z", capStart: true, capEnd: true }));
    P.push(loft(smoothRings([
      shoeRing(0.09, 0.028, 0.011, 0.011, 0.015, "sole"),
      shoeRing(0.066, 0.047, 0.015, 0.015, 0.015, "sole"),
      shoeRing(-0.1, 0.056, 0.015, 0.015, 0.015, "sole"),
      shoeRing(-0.205, 0.026, 0.013, 0.013, 0.019, "sole"),
    ], 1), { seg: 12, axis: "z", capStart: true, capEnd: true }));
    for (let k = 0; k < 3; k++) P.push(rigid(new B(0.058, 0.008, 0.014), ft, "white", { x, y: 0.102 - k * 0.012, z: -0.035 - k * 0.032, rx: 0.32 }));
  }

  // ----- braços longos e finos -----
  for (const [s, L] of [[-1, "L"], [1, "R"]] as const) {
    const ar: Joint = `arm${L}`, fo: Joint = `fore${L}`, x = s * ARM_X;
    P.push(loft(smoothRings([
      { y: 1.48, x, rx: 0.024, rf: 0.028, role: "shirt", w: one(ar) },
      { y: 1.46, x, rx: 0.04, rf: 0.046, role: "shirt", w: one(ar), sh: 1.04 },
      { y: 1.41, x, rx: 0.046, rf: 0.052, role: "shirt", w: one(ar), fx: 0.012, ff: 0.012, sh: 1.03 },
      { y: 1.34, x, rx: 0.045, rf: 0.05, role: "shirt", w: one(ar), fx: 0.018, ff: 0.018 },
      { y: 1.3, x, rx: 0.044, rf: 0.048, role: "shirt", w: one(ar), fx: 0.018, ff: 0.018, sh: 0.84 },
      { y: 1.3, x, rx: 0.037, rf: 0.04, role: "skin", w: one(ar), fx: 0.016, ff: 0.016, sh: 0.78 },
      { y: 1.24, x, rx: 0.037, rf: 0.043, role: "skin", w: one(ar), fx: 0.016, ff: 0.016 },
      { y: 1.18, x, rx: 0.031, rf: 0.033, role: "skin", w: mix(ar, fo, 0.1), fx: 0.01, ff: 0.01 },
      { y: 1.15, x, rx: 0.03, rf: 0.03, role: "skin", w: mix(ar, fo, 0.5), fx: 0.006, ff: 0.006 },
      { y: 1.115, x, rx: 0.033, rf: 0.034, role: "skin", w: mix(ar, fo, 0.88), fx: 0.008, ff: 0.008 },
      { y: 1.05, x, rx: 0.036, rf: 0.037, role: "skin", w: one(fo), fx: 0.008, ff: 0.008 },
      { y: 0.96, x, rx: 0.026, rf: 0.027, role: "skin", w: one(fo), fx: 0.004, ff: 0.004 },
      { y: 0.885, x, rx: 0.018, rf: 0.024, role: "skin", w: one(fo) },
      { y: 0.86, x, rx: 0.017, rf: 0.032, role: "skin", w: one(fo) },
      { y: 0.8, x, rx: 0.014, rf: 0.04, role: "skin", w: one(fo) }, // palma
      { y: 0.775, x, rx: 0.009, rf: 0.034, role: "skin", w: one(fo) },
    ], 2), { seg: 12, capStart: true, capEnd: true }));
    // dedos curvos e polegar
    for (let k = 0; k < 4; k++) {
      const z = -0.027 + k * 0.018, len = k === 0 || k === 3 ? 0.056 : 0.068, y0 = 0.79;
      P.push(tube([[x, y0, z], [x - s * 0.004, y0 - len * 0.5, z], [x - s * 0.014, y0 - len, z * 1.05]], [0.0085, 0.0075, 0.0055], fo, "skin", { seg: 5, sub: 1 }));
    }
    P.push(tube([[x - s * 0.006, 0.84, -0.03], [x - s * 0.014, 0.81, -0.05], [x - s * 0.02, 0.78, -0.054]], [0.011, 0.009, 0.0065], fo, "skin", { seg: 5, sub: 1 }));
  }
  // sensor de glicose (CGM) atrás do braço esquerdo
  P.push(rigid(new Cy(0.028, 0.028, 0.012, 12), "armL", "white", { x: -ARM_X, y: 1.245, z: 0.047, rx: Math.PI / 2, fat: [0, 0, 0.016] }));

  // ----- cabeça: rosto alongado, queixo marcado -----
  const H = one("head");
  P.push(loft(smoothRings([
    { y: 1.522, rx: 0.016, rf: 0.016, z: -0.062, role: "skin", w: H, sh: 0.95 },
    { y: 1.535, rx: 0.036, rf: 0.044, rb: 0.03, z: -0.04, role: "skin", w: H },
    { y: 1.565, rx: 0.058, rf: 0.076, rb: 0.056, z: -0.02, role: "skin", w: H },
    { y: 1.6, rx: 0.074, rf: 0.098, rb: 0.082, z: -0.008, role: "skin", w: H },
    { y: 1.64, rx: 0.083, rf: 0.104, rb: 0.098, role: "skin", w: H, eye: 0.08 },
    { y: 1.665, rx: 0.087, rf: 0.104, rb: 0.106, role: "skin", w: H, eye: 0.22 },
    { y: 1.695, rx: 0.09, rf: 0.114, rb: 0.112, role: "skin", w: H },
    { y: 1.74, rx: 0.09, rf: 0.104, rb: 0.112, role: "skin", w: H },
    { y: 1.775, rx: 0.068, rf: 0.076, rb: 0.086, role: "skin", w: H },
    { y: 1.795, rx: 0.02, rf: 0.02, role: "skin", w: H },
  ], 3), { seg: 22, capStart: true, capEnd: true }));
  P.push(...hairParts());
  for (const s of [-1, 1]) {
    const x = s * 0.042;
    // orelha
    P.push(tube([[s * 0.083, 1.615, 0.014], [s * 0.1, 1.635, 0.026], [s * 0.103, 1.665, 0.022], [s * 0.086, 1.68, 0.006]], [0.008, 0.014, 0.014, 0.007], "head", "skin", { seg: 6, sub: 1, flat: 0.6, sh: 0.97 }));
    // olho: branco, íris, pupila e pálpebra pesada
    P.push(rigid(new S(0.0205, 12, 9), "head", "white", { x, y: 1.662, z: -0.091 }));
    P.push(rigid(new S(0.0115, 10, 8), "head", 0x3b2616, { x: x - s * 0.002, y: 1.661, z: -0.106, sz: 0.55 }));
    P.push(rigid(new S(0.0055, 8, 6), "head", "dark", { x: x - s * 0.002, y: 1.661, z: -0.1125, sz: 0.5 }));
    P.push(rigid(new S(0.0225, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), "head", "skin", { x, y: 1.665, z: -0.0915, rx: -0.78, sh: 0.92 }));
    P.push(tube([[x + s * 0.024, 1.659, -0.094], [x, 1.6525, -0.1105], [x - s * 0.022, 1.659, -0.1035]], [0.0022, 0.0028, 0.0022], "head", 0x7c4f35, { seg: 4, sub: 1 }));
    // sobrancelha grossa
    P.push(tube([[s * 0.018, 1.692, -0.119], [s * 0.046, 1.7, -0.117], [s * 0.078, 1.692, -0.092]], [0.0075, 0.0085, 0.0035], "head", "hair", { seg: 5, sub: 2, flat: 0.7 }));
    // asa do nariz
    P.push(rigid(new S(0.0115, 9, 7), "head", "skin", { x: s * 0.0155, y: 1.6, z: -0.126, sz: 1.1 }));
  }
  // nariz grande e reto (caricato)
  P.push(tube([[0, 1.69, -0.108], [0, 1.655, -0.126], [0, 1.625, -0.144], [0, 1.602, -0.152], [0, 1.589, -0.132]], [0.0125, 0.0135, 0.0165, 0.0185, 0.012], "head", "skin", { seg: 9, sub: 2 }));
  // boca
  P.push(tube([[-0.034, 1.566, -0.086], [-0.012, 1.5625, -0.1], [0.014, 1.5635, -0.1], [0.034, 1.569, -0.086]], [0.0018, 0.0034, 0.0034, 0.0018], "head", 0x6b3226, { seg: 5, sub: 2 }));
  P.push(tube([[-0.02, 1.553, -0.094], [0, 1.5505, -0.1], [0.02, 1.553, -0.094]], [0.003, 0.0052, 0.003], "head", 0x9a5a48, { seg: 5, sub: 1 }));

  // ----- acessórios de cada visual -----
  // Corredor: faixa de cabeça
  P.push(rigid(new To(1, 0.1, 6, 24), "head", 0xff4f8b, { y: 1.735, rx: Math.PI / 2 + 0.1, sx: 0.1, sy: 0.118, sz: 0.09, skin: "corredor" }));
  P.push(tube([[0.015, 1.72, 0.122], [0.035, 1.68, 0.14], [0.03, 1.64, 0.15]], [0.012, 0.011, 0.008], "head", 0xff4f8b, { seg: 5, flat: 0.3, skin: "corredor" }));
  // Fone de ouvido
  P.push(rigid(new To(0.122, 0.011, 6, 20, Math.PI), "head", 0x2b2250, { y: 1.682, z: 0.01, sy: 1.0, skin: "fone" }));
  for (const s of [-1, 1]) {
    P.push(rigid(new Cy(0.046, 0.046, 0.032, 14), "head", 0x5a43c8, { x: s * 0.106, y: 1.655, z: 0.016, rz: Math.PI / 2, skin: "fone" }));
    P.push(rigid(new Cy(0.03, 0.03, 0.036, 12), "head", 0x2b2250, { x: s * 0.112, y: 1.655, z: 0.016, rz: Math.PI / 2, skin: "fone" }));
  }
  // Mochila de hidratação nas costas (+z, visível para a câmera)
  const back = (d: number): V3 => [0, 0, d];
  P.push(rigid(new B(0.245, 0.33, 0.09), "torso", 0x18a37a, { y: 1.3, z: 0.15, fat: back(0.04), skin: "mochila" }));
  P.push(rigid(new B(0.155, 0.19, 0.02), "torso", 0x7fd0ff, { y: 1.315, z: 0.2, fat: back(0.04), skin: "mochila" }));
  P.push(rigid(new B(0.245, 0.05, 0.1), "torso", 0x0f7d5e, { y: 1.15, z: 0.152, fat: back(0.04), skin: "mochila" }));
  P.push(tube([[0.1, 1.43, 0.12], [0.135, 1.5, 0.05], [0.12, 1.47, -0.08], [0.09, 1.4, -0.11]], [0.007, 0.007, 0.007, 0.007], "torso", 0x2b6f8f, { seg: 5, skin: "mochila" }));
  for (const s of [-1, 1]) {
    P.push(rigid(new B(0.034, 0.29, 0.016), "torso", 0x0f5e47, { x: s * 0.088, y: 1.33, z: -0.112, fat: back(-0.05), skin: "mochila" }));
    P.push(rigid(new B(0.034, 0.016, 0.21), "torso", 0x0f5e47, { x: s * 0.088, y: 1.468, skin: "mochila" }));
  }
  // ACS: colete (cor do tronco), boné e bolsa de visita a tiracolo
  P.push(rigid(new S(0.132, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), "head", 0x1f5fa8, { y: 1.715, z: 0.008, sz: 1.04, sx: 0.9, sy: 0.82, skin: "acs" }));
  P.push(loft(smoothRings([
    { y: -0.105, z: 1.722, rx: 0.08, rf: 0.006, rb: 0.006, role: 0x174a85, w: H },
    { y: -0.15, z: 1.715, rx: 0.08, rf: 0.006, rb: 0.006, role: 0x174a85, w: H },
    { y: -0.195, z: 1.704, rx: 0.06, rf: 0.005, rb: 0.005, role: 0x174a85, w: H },
  ], 1), { seg: 10, axis: "z", capStart: true, capEnd: true, skin: "acs" }));
  P.push(rigid(new B(0.06, 0.17, 0.2), "hips", 0x8a5a3b, { x: -0.178, y: 0.98, fat: [-0.05, 0, 0], skin: "acs" }));
  P.push(rigid(new B(0.066, 0.05, 0.205), "hips", 0x6f4730, { x: -0.178, y: 1.04, fat: [-0.05, 0, 0], skin: "acs" }));
  P.push(rigid(new B(0.022, 0.56, 0.01), "torso", 0x8a5a3b, { y: 1.26, z: 0.102, rz: 0.56, fat: back(0.04), skin: "acs" }));
  P.push(rigid(new B(0.022, 0.56, 0.01), "torso", 0x8a5a3b, { y: 1.26, z: -0.112, rz: 0.56, fat: back(-0.09), skin: "acs" }));
  return P;
}

const MAT = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 24, specular: 0x1c1c1c });

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
    this.label.position.set(0, 0.33, 0.106);
    this.j.torso.add(this.label);
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
      const thigh = this.bone(`thigh${L}`, hips, s * LEG_X, -0.05);
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
      skin: SKIN_TONE, hair: 0x2b1b1e, hairLight: 0x47291f, shirt: o.shirt, vest: o.vest ?? o.shirt, shorts: o.shorts, band: o.band,
      shoe: o.shoe, sole: o.sole, legs: o.legs ?? SKIN_TONE, white: 0xf4f6f8, dark: 0x1b1b1f,
    };
    return out.setHex(map[role]);
  }

  setSkin(skin: SkinId): void {
    this.skin = skin;
    this.label.visible = skin === "acs";
    if (this.mesh) { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); }
    const { geo, roles, shade } = assemble(this.parts.filter((p) => (!p.skin || p.skin === skin) && p.not !== skin), (r, c) => this.color(r, c));
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
    this.shoulders.forEach((s, i) => (s.position.x = (i ? 1 : -1) * ARM_X * (1 + 0.22 * fat)));
    this.hipJoints.forEach((h, i) => (h.position.x = (i ? 1 : -1) * LEG_X * (1 + 0.3 * fat)));
    this.label.position.z = 0.106 + 0.04 * fat;
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
