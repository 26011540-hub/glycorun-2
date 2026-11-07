import * as THREE from "three";
import { seeded, textTexture } from "./builder";
import { ROAD_W } from "./config";
import { assemble, ALL_JOINTS, loft, rigid, type Joint, type Part, type Ring, type Role, type Weights } from "./body";

/**
 * Dr. Bruce: homenagem ao golden retriever da professora, de jaleco e estetoscópio.
 * Modelo com esqueleto próprio, no mesmo estilo do personagem. Ele olha para -z, como o corredor.
 * Os nomes dos ossos são os do corpo humano: arm/fore = pata da frente, thigh/shin/foot = pata de trás.
 * É só cenário: atravessa a rua, para e late; não tem colisão nem efeito nas regras.
 */

const GOLD = 0xf0d9ad, LIGHT = 0xfaf0da, EAR = 0xe2bb80, DEEP = 0xe2c28e;
const COAT = 0xfbfbf7, NOSE = 0x1d1716, MOUTH = 0x4d2024, TONGUE = 0xec8fa0;
const SILVER = 0xc9ced6, TUBE = 0x22303f, RED = 0xc8342c;

const one = (j: Joint): Weights => [[j, 1]];
const mix = (a: Joint, b: Joint, t: number): Weights => [[a, 1 - t], [b, t]];

/** Anel ao longo do corpo do cão (eixo z): up/down = meia altura acima e abaixo do centro cy. */
const zr = (z: number, rx: number, up: number, down: number, cy: number, role: Role, w: Weights, sh = 1): Ring =>
  ({ y: z, z: cy, rx, rf: up, rb: down, role, w, sh });

function buildParts(): Part[] {
  const S = THREE.SphereGeometry, B = THREE.BoxGeometry, Cy = THREE.CylinderGeometry, To = THREE.TorusGeometry, Co = THREE.ConeGeometry, Ic = THREE.IcosahedronGeometry;
  const P: Part[] = [];
  const r = seeded(21);
  const H = one("head"), hips = one("hips"), torso = one("torso");
  /** Tufo de pelo: cone apontando para baixo (ou inclinado com rx/rz). */
  const tuft = (j: Joint, x: number, y: number, z: number, len: number, rad: number, color: number, rx = 0, rz = 0) =>
    P.push(rigid(new Co(rad, len, 5), j, color, { x, y, z, rx: Math.PI + rx, rz }));

  // ----- tronco, da anca ao peito -----
  const trunk = (add: number, role: Role, tone: number, from: number, to: number) => [
    zr(0.52, 0.07 + add, 0.07 + add, 0.07 + add, 0.72, role, hips, tone),
    zr(0.43, 0.155 + add, 0.15 + add, 0.16 + add, 0.69, role, hips, tone),
    zr(0.3, 0.19 + add, 0.17 + add, 0.2 + add, 0.67, role, hips, tone),
    zr(0.1, 0.19 + add, 0.165 + add, 0.185 + add, 0.67, role, mix("hips", "torso", 0.4), tone),
    zr(-0.08, 0.2 + add, 0.175 + add, 0.2 + add, 0.685, role, mix("hips", "torso", 0.75), tone),
    zr(-0.25, 0.21 + add, 0.185 + add, 0.235 + add, 0.7, role, torso, tone),
    zr(-0.4, 0.17 + add, 0.17 + add, 0.215 + add, 0.74, role, torso, tone),
    zr(-0.48, 0.085 + add, 0.115 + add, 0.14 + add, 0.78, role, torso, tone),
  ].filter((q) => q.y <= from && q.y >= to);
  P.push(loft(trunk(0, GOLD, 1, 1, -1), { seg: 14, axis: "z", capStart: true, capEnd: true, seed: 2, jitter: 0.02 }));

  // ----- jaleco: uma camada branca sobre o tronco -----
  P.push(loft([zr(0.24, 0.212, 0.19, 0.2, 0.675, COAT, mix("hips", "torso", 0.15), 0.9), ...trunk(0.026, COAT, 1, 0.2, -0.42)], { seg: 14, axis: "z", capEnd: true, seed: 3, jitter: 0.012 }));
  for (const s of [-1, 1]) {
    // gola, bolso com caneta
    P.push(rigid(new B(0.03, 0.17, 0.13), "torso", COAT, { x: s * 0.095, y: 0.855, z: -0.4, rz: s * 0.5, rx: 0.55, sh: 0.93 }));
    P.push(rigid(new B(0.012, 0.13, 0.16), "torso", 0xeff1ee, { x: s * 0.238, y: 0.6, z: 0.02 }));
    P.push(rigid(new B(0.016, 0.1, 0.012), "torso", 0x2f7fe0, { x: s * 0.243, y: 0.66, z: 0.07 }));
  }
  for (let k = 0; k < 3; k++) P.push(rigid(new S(0.013, 7, 5), "torso", 0x8fb4d8, { y: 0.915, z: 0.12 - k * 0.15 }));

  // ----- pescoço -----
  P.push(loft([
    { y: 0.74, z: -0.33, rx: 0.155, rf: 0.15, rb: 0.14, role: GOLD, w: mix("torso", "neck", 0.2) },
    { y: 0.84, z: -0.385, rx: 0.13, rf: 0.13, rb: 0.12, role: GOLD, w: mix("torso", "neck", 0.7) },
    { y: 0.94, z: -0.44, rx: 0.108, rf: 0.11, rb: 0.105, role: GOLD, w: mix("neck", "head", 0.4) },
    { y: 1.03, z: -0.485, rx: 0.1, rf: 0.1, rb: 0.1, role: GOLD, w: H },
  ], { seg: 12, seed: 4 }));

  // ----- cabeça e focinho -----
  P.push(loft([
    zr(-0.385, 0.06, 0.06, 0.06, 1.04, GOLD, H),
    zr(-0.44, 0.145, 0.135, 0.12, 1.04, GOLD, H, 1.02),
    zr(-0.52, 0.172, 0.15, 0.13, 1.04, GOLD, H, 1.03),
    zr(-0.595, 0.158, 0.125, 0.122, 1.03, LIGHT, H),
    zr(-0.64, 0.112, 0.085, 0.09, 0.992, LIGHT, H, 1.02),
    zr(-0.695, 0.096, 0.064, 0.066, 0.972, LIGHT, H),
    zr(-0.74, 0.078, 0.048, 0.044, 0.966, LIGHT, H),
    zr(-0.765, 0.038, 0.024, 0.022, 0.966, LIGHT, H),
  ], { seg: 12, axis: "z", capStart: true, capEnd: true, seed: 5, jitter: 0.012 }));
  // listra mais clara no meio da testa, como nas fotos
  P.push(rigid(new Ic(0.05, 1), "head", LIGHT, { y: 1.15, z: -0.55, sx: 0.85, sy: 0.32, sz: 1.5, rx: -0.3 }));
  P.push(rigid(new Ic(0.036, 1), "head", NOSE, { y: 0.998, z: -0.76, sx: 1.3, sy: 0.85, sz: 0.9 }));
  P.push(rigid(new B(0.1, 0.03, 0.12), "head", MOUTH, { y: 0.94, z: -0.665 }));
  for (const s of [-1, 1]) {
    // olhos com brilho e sobrancelha clara
    P.push(rigid(new S(0.024, 8, 6), "head", NOSE, { x: s * 0.09, y: 1.078, z: -0.632 }));
    P.push(rigid(new S(0.007, 5, 4), "head", 0xffffff, { x: s * 0.09 - 0.007, y: 1.088, z: -0.654 }));
    P.push(rigid(new S(0.018, 6, 4), "head", LIGHT, { x: s * 0.092, y: 1.122, z: -0.61, sx: 1.5, sy: 0.6 }));
    // orelhas caídas
    P.push(rigid(new Ic(0.1, 1), "head", EAR, { x: s * 0.178, y: 1.0, z: -0.49, sx: 0.36, sy: 1.2, sz: 0.8, rz: s * 0.2 }));
    P.push(rigid(new Ic(0.04, 1), "head", EAR, { x: s * 0.19, y: 0.905, z: -0.49, sx: 0.6 }));
    // bochecha fofa
    P.push(rigid(new Ic(0.06, 1), "head", LIGHT, { x: s * 0.125, y: 0.955, z: -0.56, sy: 0.85 }));
  }
  // mandíbula e língua (a boca abre ao latir)
  P.push(loft([
    zr(-0.58, 0.09, 0.025, 0.032, 0.915, LIGHT, one("jaw")),
    zr(-0.66, 0.08, 0.022, 0.03, 0.91, LIGHT, one("jaw")),
    zr(-0.725, 0.054, 0.018, 0.022, 0.91, LIGHT, one("jaw")),
  ], { seg: 8, axis: "z", capStart: true, capEnd: true, seed: 6 }));
  P.push(rigid(new Ic(0.05, 1), "jaw", TONGUE, { y: 0.935, z: -0.68, sx: 1.05, sy: 0.22, sz: 1.3 }));
  P.push(rigid(new Ic(0.03, 1), "jaw", TONGUE, { y: 0.92, z: -0.74, sx: 1.25, sy: 0.32, sz: 1.2, rx: 0.6 }));

  // ----- coleira vermelha, plaquinha de osso e estetoscópio -----
  P.push(rigid(new To(0.122, 0.017, 6, 20), "neck", RED, { y: 0.905, z: -0.425, rx: Math.PI / 2 - 0.42 }));
  for (const dx of [-0.022, 0.022]) P.push(rigid(new S(0.02, 6, 5), "neck", SILVER, { x: 0.075 + dx, y: 0.86, z: -0.6 }));
  P.push(rigid(new B(0.05, 0.022, 0.014), "neck", SILVER, { x: 0.075, y: 0.86, z: -0.6 }));
  P.push(rigid(new To(0.19, 0.011, 5, 22), "neck", TUBE, { y: 0.83, z: -0.42, rx: Math.PI / 2 - 0.42 }));
  for (const s of [-1, 1]) P.push(rigid(new Cy(0.01, 0.01, 0.15, 5), "torso", TUBE, { x: s * 0.03, y: 0.7, z: -0.615, rz: s * 0.28, rx: 0.1 }));
  P.push(rigid(new Cy(0.01, 0.01, 0.07, 5), "torso", TUBE, { y: 0.595, z: -0.625 }));
  P.push(rigid(new Cy(0.046, 0.046, 0.02, 12), "torso", SILVER, { y: 0.55, z: -0.625, rx: Math.PI / 2 }));
  P.push(rigid(new Cy(0.028, 0.028, 0.024, 10), "torso", 0x8d949e, { y: 0.55, z: -0.635, rx: Math.PI / 2 }));

  // ----- patas da frente (manga do jaleco no alto) -----
  for (const [s, L] of [[-1, "L"], [1, "R"]] as const) {
    const ar: Joint = `arm${L}`, fo: Joint = `fore${L}`, x = s * 0.135, z = -0.3;
    P.push(loft([
      { y: 0.72, x, z, rx: 0.06, rf: 0.08, role: COAT, w: one(ar) },
      { y: 0.63, x, z, rx: 0.088, rf: 0.098, role: COAT, w: one(ar) },
      { y: 0.5, x, z, rx: 0.078, rf: 0.082, role: COAT, w: one(ar), sh: 0.88 },
      { y: 0.5, x, z, rx: 0.072, rf: 0.079, role: GOLD, w: one(ar), sh: 0.92 },
      { y: 0.41, x, z, rx: 0.062, rf: 0.070, role: GOLD, w: mix(ar, fo, 0.2) },
      { y: 0.36, x, z, rx: 0.060, rf: 0.067, role: GOLD, w: mix(ar, fo, 0.5) },
      { y: 0.31, x, z, rx: 0.055, rf: 0.060, role: GOLD, w: mix(ar, fo, 0.85) },
      { y: 0.2, x, z, rx: 0.050, rf: 0.054, role: LIGHT, w: one(fo) },
      { y: 0.09, x, z, rx: 0.050, rf: 0.056, role: LIGHT, w: one(fo) },
      { y: 0.05, x, z: z - 0.012, rx: 0.055, rf: 0.067, role: LIGHT, w: one(fo) },
    ], { seg: 9, capStart: true, seed: 7 + s }));
    P.push(rigid(new Ic(0.072, 1), fo, LIGHT, { x, y: 0.048, z: z - 0.03, sy: 0.7, sz: 1.3 }));
    for (let k = -1; k <= 1; k++) P.push(rigid(new S(0.02, 6, 4), fo, 0xefe0c2, { x: x + k * 0.03, y: 0.03, z: z - 0.1 }));
    for (let k = 0; k < 4; k++) tuft(fo, x, 0.33 - k * 0.05, z + 0.06, 0.09, 0.03, LIGHT, -0.55, 0); // franja atrás da pata
  }

  // ----- patas de trás -----
  for (const [s, L] of [[-1, "L"], [1, "R"]] as const) {
    const th: Joint = `thigh${L}`, sh: Joint = `shin${L}`, ft: Joint = `foot${L}`, x = s * 0.135;
    P.push(loft([
      { y: 0.76, x, z: 0.32, rx: 0.07, rf: 0.1, rb: 0.11, role: GOLD, w: mix("hips", th, 0.5) },
      { y: 0.6, x, z: 0.34, rx: 0.1, rf: 0.135, rb: 0.14, role: GOLD, w: one(th) },
      { y: 0.47, x, z: 0.37, rx: 0.078, rf: 0.092, rb: 0.105, role: GOLD, w: one(th) },
      { y: 0.39, x, z: 0.39, rx: 0.067, rf: 0.074, rb: 0.086, role: GOLD, w: mix(th, sh, 0.4) },
      { y: 0.32, x, z: 0.42, rx: 0.056, rf: 0.060, rb: 0.067, role: GOLD, w: mix(th, sh, 0.8) },
      { y: 0.22, x, z: 0.46, rx: 0.049, rf: 0.048, rb: 0.055, role: LIGHT, w: one(sh) },
      { y: 0.15, x, z: 0.47, rx: 0.048, rf: 0.050, rb: 0.060, role: LIGHT, w: mix(sh, ft, 0.6) },
      { y: 0.08, x, z: 0.44, rx: 0.050, rf: 0.060, rb: 0.048, role: LIGHT, w: one(ft) },
    ], { seg: 9, seed: 12 + s }));
    P.push(rigid(new Ic(0.072, 1), ft, LIGHT, { x, y: 0.048, z: 0.41, sy: 0.7, sz: 1.35 }));
    for (let k = -1; k <= 1; k++) P.push(rigid(new S(0.02, 6, 4), ft, 0xefe0c2, { x: x + k * 0.03, y: 0.03, z: 0.33 }));
    for (let k = 0; k < 4; k++) P.push(rigid(new Ic(0.055, 1), th, k % 2 ? LIGHT : GOLD, { x: x + s * 0.015, y: 0.62 - k * 0.07, z: 0.47, sy: 1.4, sz: 0.7, rx: -0.4 })); // culote
  }

  // ----- rabo fofo e curvado para cima -----
  P.push(loft([
    zr(0.5, 0.05, 0.05, 0.05, 0.75, GOLD, one("tail1")),
    zr(0.58, 0.085, 0.085, 0.105, 0.83, GOLD, one("tail1")),
    zr(0.68, 0.095, 0.095, 0.125, 0.93, LIGHT, mix("tail1", "tail2", 0.5)),
    zr(0.77, 0.075, 0.075, 0.1, 1.02, LIGHT, one("tail2")),
    zr(0.84, 0.03, 0.03, 0.03, 1.06, LIGHT, one("tail2")),
  ], { seg: 10, axis: "z", capStart: true, capEnd: true, seed: 15, jitter: 0.04 }));
  for (let k = 0; k < 9; k++) {
    const t = k / 8, j: Joint = t < 0.5 ? "tail1" : "tail2";
    P.push(rigid(new Ic(0.07 - t * 0.02, 1), j, k % 2 ? LIGHT : 0xfff5e2, { x: (r() - 0.5) * 0.12, y: 0.74 + t * 0.24, z: 0.6 + t * 0.26, sy: 1.5, sx: 0.85, rx: 0.75 }));
  }

  // ----- pelo: juba sobre a gola do jaleco, nuca e costas -----
  for (let k = 0; k < 22; k++) {
    const a = (k / 21) * Math.PI - Math.PI / 2;
    P.push(rigid(new Ic(0.05 + r() * 0.025, 1), "neck", k % 3 ? LIGHT : GOLD, { x: Math.sin(a) * 0.17 + (r() - 0.5) * 0.03, y: 0.7 + r() * 0.13, z: -0.43 - Math.cos(a) * 0.1, sy: 1.5, sz: 0.7, rz: Math.sin(a) * 0.3 }));
  }
  for (let k = 0; k < 10; k++) {
    const a = (k / 9) * 2.2 - 1.1;
    P.push(rigid(new Ic(0.05 + r() * 0.015, 1), "torso", LIGHT, { x: Math.sin(a) * 0.13, y: 0.65 - Math.abs(a) * 0.02 + (k % 2) * 0.05, z: -0.535, sy: 1.35, sz: 0.65 }));
  }
  for (let k = 0; k < 8; k++) tuft("neck", (r() - 0.5) * 0.18, 0.97 - r() * 0.1, -0.35 + r() * 0.05, 0.1, 0.035, DEEP, 0.9, 0);
  for (let k = 0; k < 8; k++) tuft("hips", (r() - 0.5) * 0.32, 0.87, 0.3 + r() * 0.17, 0.1, 0.038, k % 2 ? DEEP : GOLD, 1.35, 0);
  return P;
}

// Posição dos ossos em repouso
const REST: Record<string, [string, number, number, number]> = {
  hips: ["", 0, 0.62, 0.3], torso: ["hips", 0, 0.06, -0.55], neck: ["torso", 0, 0.12, -0.15], head: ["neck", 0, 0.2, -0.1], jaw: ["head", 0, -0.075, -0.1],
  armL: ["torso", -0.135, -0.06, -0.05], armR: ["torso", 0.135, -0.06, -0.05], foreL: ["armL", 0, -0.26, 0], foreR: ["armR", 0, -0.26, 0],
  thighL: ["hips", -0.135, -0.02, 0.03], thighR: ["hips", 0.135, -0.02, 0.03], shinL: ["thighL", 0, -0.26, 0.06], shinR: ["thighR", 0, -0.26, 0.06],
  footL: ["shinL", 0, -0.2, 0.08], footR: ["shinR", 0, -0.2, 0.08], tail1: ["hips", 0, 0.12, 0.2], tail2: ["tail1", 0, 0.16, 0.17],
};

const SIDE_X = ROAD_W / 2 + 0.65;
const BARK_GAP = 0.36; // segundos entre latidos
const ARRIVE_AHEAD = 33; // distância do jogador quando ele termina de atravessar
type Stage = "off" | "cross" | "turn" | "bark" | "wait";

export class Bruce {
  readonly group = new THREE.Group();
  /** Chamado a cada latido e quando ele para do outro lado. */
  onBark: (() => void) | null = null;
  onArrive: (() => void) | null = null;
  private body = new THREE.Group();
  private j = {} as Record<Joint, THREE.Bone>;
  private stage: Stage = "off";
  private at = 0; // posição ao longo da rua
  private x = -SIDE_X;
  private t = 0;
  private crossTime = 2.5;
  private phase = 0;
  private barks = 0;
  private ry = -Math.PI / 2;
  private jumpV = 0;
  private jumpY = 0;

  constructor() {
    for (const name of ALL_JOINTS) {
      const rest = REST[name];
      if (!rest) continue;
      this.j[name] = new THREE.Bone();
    }
    for (const [name, [parent, x, y, z]] of Object.entries(REST)) {
      const b = this.j[name as Joint];
      b.position.set(x, y, z);
      (parent ? this.j[parent as Joint] : this.body).add(b);
    }
    this.body.updateMatrixWorld(true);
    const bones = ALL_JOINTS.map((n) => this.j[n] ?? new THREE.Bone());
    const { geo } = assemble(buildParts(), (role, c) => c.setHex(role as number));
    const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    mesh.frustumCulled = false;
    this.body.add(mesh);
    mesh.bind(new THREE.Skeleton(bones), new THREE.Matrix4());

    // plaquinhas "Dr. Bruce" nos dois lados do jaleco
    const name = new THREE.MeshBasicMaterial({ map: textTexture("Dr. Bruce", { w: 256, h: 72, bg: "#ffffff", fg: "#1f5fa8", radius: 10 }) });
    for (const s of [-1, 1]) {
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.085), name);
      tag.position.set(s * 0.241, 0.03, 0.14);
      tag.rotation.y = (s * Math.PI) / 2;
      this.j.torso.add(tag);
    }
    this.body.scale.setScalar(1.5);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.09;
    shadow.scale.set(0.8, 1.1, 1);
    this.group.add(this.body, shadow);
    this.group.visible = false;
  }

  get active(): boolean { return this.stage !== "off"; }

  /** Começa a cena: at = ponto da rua onde ele atravessa; a travessia acompanha o ritmo do jogador. */
  start(at: number, dist: number, speed: number): void {
    this.at = at;
    this.x = -SIDE_X;
    this.t = 0;
    this.ry = -Math.PI / 2;
    this.barks = 0;
    // termina sempre à mesma distância do jogador, para os latidos acontecerem bem à vista
    this.crossTime = Math.max(0.9, Math.min(2.6, (at - dist - ARRIVE_AHEAD) / speed));
    this.stage = "cross";
    this.group.visible = true;
  }

  stop(): void {
    this.stage = "off";
    this.group.visible = false;
  }

  update(dist: number, dt: number): void {
    if (this.stage === "off") return;
    this.t += dt;
    const J = this.j;
    let trot = 0;
    if (this.stage === "cross") {
      trot = 1;
      const k = Math.min(1, this.t / this.crossTime);
      this.x = -SIDE_X + 2 * SIDE_X * k;
      if (k >= 1) { this.stage = "turn"; this.t = 0; this.onArrive?.(); }
    } else if (this.stage === "turn") {
      this.ry += (-Math.PI * 0.86 - this.ry) * Math.min(1, dt * 14);
      if (this.t > 0.16) { this.stage = "bark"; this.t = 0; }
    } else if (this.stage === "bark" && this.t > 0.05 + this.barks * BARK_GAP) {
      this.barks++;
      this.jumpV = 1.5;
      this.onBark?.();
      if (this.barks >= 3) this.stage = "wait";
    }
    if (this.at < dist - 12) this.stop();

    // pulinho do latido
    this.jumpV -= 9 * dt;
    this.jumpY = Math.max(0, this.jumpY + this.jumpV * dt);

    // pose
    this.phase += dt * (trot ? 13 : 0);
    const s = Math.sin(this.phase), c = Math.cos(this.phase), k = Math.min(1, dt * 14);
    const set = (b: THREE.Bone, v: number) => { b.rotation.x += (v - b.rotation.x) * k; };
    set(J.armL, trot * 0.55 * s); set(J.armR, -trot * 0.55 * s);
    set(J.foreL, -trot * 0.75 * Math.max(0, c)); set(J.foreR, -trot * 0.75 * Math.max(0, -c));
    set(J.thighR, trot * 0.5 * s); set(J.thighL, -trot * 0.5 * s);
    set(J.shinR, trot * 0.55 * Math.max(0, -c)); set(J.shinL, trot * 0.55 * Math.max(0, c));
    J.hips.position.y = 0.62 + trot * 0.02 * Math.abs(c);
    const talking = Math.max(0, Math.sin(Math.min(1, (this.t - (this.barks - 1) * BARK_GAP) / 0.3) * Math.PI));
    const barking = this.stage === "bark" || (this.stage === "wait" && this.t < 1.1);
    set(J.neck, barking ? 0.28 : trot * 0.05 * s);
    set(J.jaw, -0.2 - (barking ? 0.5 * talking : 0));
    const time = performance.now() / 1000;
    J.tail1.rotation.z = Math.sin(time * (trot ? 10 : 15)) * 0.32;
    J.tail2.rotation.z = Math.sin(time * (trot ? 10 : 15) - 0.8) * 0.4;

    const onWalk = Math.abs(this.x) > ROAD_W / 2 ? 0.07 : 0;
    this.body.position.y = onWalk + this.jumpY;
    this.group.position.set(this.x, 0, -(this.at - dist));
    this.body.rotation.y = this.ry;
  }
}
