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
    zr(0.52, 0.075 + add, 0.07 + add, 0.08 + add, 0.73, role, hips, tone),
    zr(0.45, 0.16 + add, 0.15 + add, 0.17 + add, 0.71, role, hips, tone),
    zr(0.32, 0.195 + add, 0.17 + add, 0.2 + add, 0.685, role, hips, tone),
    zr(0.12, 0.178 + add, 0.158 + add, 0.15 + add, 0.685, role, mix("hips", "torso", 0.4), tone),
    zr(-0.08, 0.19 + add, 0.17 + add, 0.2 + add, 0.685, role, mix("hips", "torso", 0.75), tone),
    zr(-0.25, 0.212 + add, 0.2 + add, 0.25 + add, 0.7, role, torso, tone),
    zr(-0.4, 0.178 + add, 0.178 + add, 0.235 + add, 0.74, role, torso, tone),
    zr(-0.48, 0.09 + add, 0.12 + add, 0.15 + add, 0.78, role, torso, tone),
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
    zr(-0.635, 0.122, 0.09, 0.098, 0.988, LIGHT, H, 1.02),
    zr(-0.7, 0.114, 0.074, 0.084, 0.966, LIGHT, H),
    zr(-0.765, 0.102, 0.062, 0.07, 0.96, LIGHT, H),
    zr(-0.8, 0.066, 0.042, 0.046, 0.964, LIGHT, H),
  ], { seg: 12, axis: "z", capStart: true, capEnd: true, seed: 5, jitter: 0.012 }));
  P.push(rigid(new Ic(0.04, 1), "head", NOSE, { y: 1.0, z: -0.8, sx: 1.3, sy: 0.82, sz: 0.9 }));
  P.push(rigid(new B(0.16, 0.03, 0.16), "head", MOUTH, { y: 0.925, z: -0.69 }));
  for (const s of [-1, 1]) {
    // olhos com brilho e sobrancelha clara
    P.push(rigid(new S(0.024, 8, 6), "head", NOSE, { x: s * 0.09, y: 1.078, z: -0.632 }));
    P.push(rigid(new S(0.007, 5, 4), "head", 0xffffff, { x: s * 0.09 - 0.007, y: 1.088, z: -0.654 }));
    P.push(rigid(new S(0.016, 6, 4), "head", 0xf4e2bd, { x: s * 0.092, y: 1.116, z: -0.606, sx: 1.5, sy: 0.5 }));
    // orelhas caídas
    P.push(loft([
      { y: 1.135, x: s * 0.142, z: -0.49, rx: 0.028, rf: 0.07, rb: 0.06, role: EAR, w: H },
      { y: 1.07, x: s * 0.178, z: -0.5, rx: 0.036, rf: 0.098, rb: 0.085, role: EAR, w: H },
      { y: 0.985, x: s * 0.195, z: -0.51, rx: 0.03, rf: 0.078, rb: 0.07, role: EAR, w: H },
      { y: 0.915, x: s * 0.198, z: -0.525, rx: 0.012, rf: 0.026, rb: 0.026, role: EAR, w: H },
    ], { seg: 8, capStart: true, capEnd: true, seed: 30 + s }));
  }
  // mandíbula e língua (a boca abre ao latir)
  P.push(loft([
    zr(-0.58, 0.1, 0.025, 0.034, 0.905, LIGHT, one("jaw")),
    zr(-0.69, 0.096, 0.022, 0.032, 0.9, LIGHT, one("jaw")),
    zr(-0.77, 0.07, 0.018, 0.024, 0.9, LIGHT, one("jaw")),
  ], { seg: 8, axis: "z", capStart: true, capEnd: true, seed: 6 }));
  P.push(rigid(new Ic(0.05, 1), "jaw", TONGUE, { y: 0.925, z: -0.71, sx: 1.2, sy: 0.22, sz: 1.5 }));
  P.push(rigid(new Ic(0.03, 1), "jaw", TONGUE, { y: 0.9, z: -0.78, sx: 1.4, sy: 0.32, sz: 1.2, rx: 0.6 }));

  // ----- coleira vermelha, plaquinha de osso e estetoscópio -----
  P.push(rigid(new To(0.122, 0.017, 6, 20), "neck", RED, { y: 0.905, z: -0.425, rx: Math.PI / 2 - 0.42 }));
  for (const dx of [-0.022, 0.022]) P.push(rigid(new S(0.02, 6, 5), "neck", SILVER, { x: 0.075 + dx, y: 0.87, z: -0.59 }));
  P.push(rigid(new B(0.05, 0.022, 0.014), "neck", SILVER, { x: 0.075, y: 0.87, z: -0.59 }));
  P.push(rigid(new To(0.19, 0.011, 5, 22), "neck", TUBE, { y: 0.83, z: -0.42, rx: Math.PI / 2 - 0.42 }));
  for (const s of [-1, 1]) P.push(rigid(new Cy(0.01, 0.01, 0.17, 5), "torso", TUBE, { x: s * 0.03, y: 0.72, z: -0.645, rz: s * 0.28, rx: 0.1 }));
  P.push(rigid(new Cy(0.01, 0.01, 0.07, 5), "torso", TUBE, { y: 0.6, z: -0.65 }));
  P.push(rigid(new Cy(0.046, 0.046, 0.02, 12), "torso", SILVER, { y: 0.555, z: -0.65, rx: Math.PI / 2 }));
  P.push(rigid(new Cy(0.028, 0.028, 0.024, 10), "torso", 0x8d949e, { y: 0.555, z: -0.66, rx: Math.PI / 2 }));

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
    for (let k = 0; k < 4; k++) P.push(rigid(new Ic(0.06, 1), th, LIGHT, { x: x + s * 0.01, y: 0.62 - k * 0.075, z: 0.475 + k * 0.008, sy: 1.5, sz: 0.62, rx: -0.3 })); // culote
  }

  // ----- rabo fofo e curvado para cima -----
  P.push(loft([
    zr(0.5, 0.05, 0.05, 0.05, 0.76, GOLD, one("tail1")),
    zr(0.62, 0.07, 0.07, 0.1, 0.79, GOLD, one("tail1")),
    zr(0.76, 0.075, 0.068, 0.135, 0.82, GOLD, mix("tail1", "tail2", 0.5)),
    zr(0.9, 0.06, 0.052, 0.12, 0.86, LIGHT, one("tail2")),
    zr(1.0, 0.03, 0.03, 0.05, 0.91, LIGHT, one("tail2")),
  ], { seg: 10, axis: "z", capStart: true, capEnd: true, seed: 15, jitter: 0.05 }));

  // ----- pelo: juba sobre a gola do jaleco, nuca e costas -----
  P.push(loft([
    { y: 0.92, z: -0.5, rx: 0.1, rf: 0.04, rb: 0.03, role: LIGHT, w: one("neck") },
    { y: 0.8, z: -0.54, rx: 0.15, rf: 0.075, rb: 0.05, role: LIGHT, w: mix("torso", "neck", 0.6) },
    { y: 0.68, z: -0.565, rx: 0.135, rf: 0.085, rb: 0.05, role: LIGHT, w: torso },
    { y: 0.58, z: -0.56, rx: 0.095, rf: 0.07, rb: 0.05, role: LIGHT, w: torso },
    { y: 0.5, z: -0.54, rx: 0.045, rf: 0.04, rb: 0.03, role: LIGHT, w: torso },
    { y: 0.455, z: -0.525, rx: 0.012, rf: 0.012, rb: 0.012, role: LIGHT, w: torso },
  ], { seg: 12, seed: 18, jitter: 0.07 }));
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) tuft("torso", s * (0.075 + k * 0.03), 0.55 + k * 0.05, -0.56, 0.11, 0.035, LIGHT, 0, s * 0.12);
  for (let k = 0; k < 8; k++) tuft("neck", (r() - 0.5) * 0.18, 0.97 - r() * 0.1, -0.35 + r() * 0.05, 0.1, 0.035, DEEP, 0.9, 0);
  for (let k = 0; k < 8; k++) tuft("hips", (r() - 0.5) * 0.32, 0.87, 0.3 + r() * 0.17, 0.1, 0.038, k % 2 ? DEEP : GOLD, 1.35, 0);
  return P;
}

// Posição dos ossos em repouso
const REST: Record<string, [string, number, number, number]> = {
  hips: ["", 0, 0.62, 0.3], torso: ["hips", 0, 0.06, -0.55], neck: ["torso", 0, 0.12, -0.15], head: ["neck", 0, 0.2, -0.1], jaw: ["head", 0, -0.075, -0.1],
  armL: ["torso", -0.135, -0.06, -0.05], armR: ["torso", 0.135, -0.06, -0.05], foreL: ["armL", 0, -0.26, 0], foreR: ["armR", 0, -0.26, 0],
  thighL: ["hips", -0.135, -0.02, 0.03], thighR: ["hips", 0.135, -0.02, 0.03], shinL: ["thighL", 0, -0.26, 0.06], shinR: ["thighR", 0, -0.26, 0.06],
  footL: ["shinL", 0, -0.2, 0.08], footR: ["shinR", 0, -0.2, 0.08], tail1: ["hips", 0, 0.12, 0.2], tail2: ["tail1", 0, 0.07, 0.24],
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
  private x = SIDE_X;
  private t = 0;
  private crossTime = 2.5;
  private phase = 0;
  private barks = 0;
  private ry = Math.PI / 2;
  private clock = 0;
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
    const { geo, roles } = assemble(buildParts(), (role, c) => c.setHex(role as number));
    this.paintCoat(geo, roles);
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
    this.body.scale.setScalar(1.3);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.78, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.09;
    shadow.scale.set(0.8, 1.1, 1);
    this.group.add(this.body, shadow);
    this.group.visible = false;
  }

  private paintCoat(geo: THREE.BufferGeometry, roles: Role[]): void {
    const pos = geo.attributes.position, col = geo.attributes.color as THREE.BufferAttribute;
    const top = new THREE.Color(0xe2bc80), low = new THREE.Color(0xfbf2de), c = new THREE.Color();
    roles.forEach((r, i) => {
      if (r !== GOLD && r !== LIGHT) return;
      const t = Math.max(0, Math.min(1, (pos.getY(i) - 0.42) / 0.5));
      c.fromBufferAttribute(col, i).lerp(low, (1 - t) * 0.55).lerp(top, r === GOLD ? t * 0.6 : t * 0.15);
      col.setXYZ(i, c.r, c.g, c.b);
    });
  }

  get active(): boolean { return this.stage !== "off"; }

  /** Começa a cena: at = ponto da rua onde ele atravessa; a travessia acompanha o ritmo do jogador. */
  start(at: number, dist: number, speed: number): void {
    this.at = at;
    this.x = SIDE_X;
    this.t = 0;
    this.ry = Math.PI / 2;
    this.barks = 0;
    // termina sempre à mesma distância do jogador, para os latidos acontecerem bem à vista
    this.crossTime = Math.max(1.2, Math.min(2.8, (at - dist - ARRIVE_AHEAD) / speed));
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
    this.clock += dt;
    const J = this.j;
    let trot = 0;
    if (this.stage === "cross") {
      // arranca e freia aos poucos, em vez de andar em velocidade constante
      const k = Math.min(1, this.t / this.crossTime), e = 0.5 * k + 0.5 * k * k * (3 - 2 * k);
      this.x = SIDE_X - 2 * SIDE_X * e;
      trot = Math.min(1, Math.min(k, 1 - k) * 9 + 0.25);
      if (k >= 1) { this.stage = "turn"; this.t = 0; this.onArrive?.(); }
    } else if (this.stage === "turn") {
      this.ry += (Math.PI * 0.86 - this.ry) * Math.min(1, dt * 12);
      if (this.t > 0.18) { this.stage = "bark"; this.t = 0; }
    } else if (this.stage === "bark" && this.t > 0.05 + this.barks * BARK_GAP) {
      this.barks++;
      this.jumpV = 1.35;
      this.onBark?.();
      if (this.barks >= 3) this.stage = "wait";
    }
    if (this.at < dist - 12) this.stop();

    this.jumpV -= 9 * dt;
    this.jumpY = Math.max(0, this.jumpY + this.jumpV * dt);

    // Trote: pares diagonais, a pata da frente um pouco adiantada, instante sem apoio na troca dos pares.
    this.phase += dt * 17 * (0.4 + 0.6 * trot);
    const a = this.phase, lead = 0.32, sinA = Math.sin(a), cosA = Math.cos(a);
    const f1 = Math.sin(a + lead), f2 = -f1, c1 = Math.cos(a + lead);
    const k = 1 - Math.exp(-dt * 30);
    const rot = (b: THREE.Bone, axis: "x" | "y" | "z", v: number) => { b.rotation[axis] += (v - b.rotation[axis]) * k; };
    rot(J.armL, "x", trot * 0.62 * f1); rot(J.armR, "x", trot * 0.62 * f2);
    rot(J.foreL, "x", -trot * 1.0 * Math.max(0, c1)); rot(J.foreR, "x", -trot * 1.0 * Math.max(0, -c1));
    rot(J.thighR, "x", trot * 0.56 * sinA); rot(J.thighL, "x", -trot * 0.56 * sinA);
    rot(J.shinR, "x", trot * 0.75 * Math.max(0, cosA)); rot(J.shinL, "x", trot * 0.75 * Math.max(0, -cosA));
    rot(J.footR, "x", -trot * 0.5 * Math.max(0, cosA)); rot(J.footL, "x", -trot * 0.5 * Math.max(0, -cosA));
    // o corpo sobe duas vezes por ciclo, balança e torce um pouco; cabeça e rabo vêm depois, com atraso
    J.hips.position.y = 0.605 + trot * 0.032 * Math.abs(sinA);
    rot(J.hips, "z", trot * 0.04 * sinA);
    rot(J.hips, "x", trot * 0.025 * Math.sin(2 * a));
    rot(J.torso, "y", -trot * 0.07 * sinA);
    rot(J.torso, "z", -trot * 0.05 * sinA);

    const since = this.t - (this.barks - 1) * BARK_GAP;
    const pulse = (this.stage === "bark" || this.stage === "wait") && this.barks > 0 ? Math.max(0, Math.sin(Math.min(1, since / 0.26) * Math.PI)) : 0;
    const alert = this.stage === "bark" ? 1 : 0;
    rot(J.neck, "x", trot * 0.05 * Math.sin(2 * a - 0.9) + alert * 0.16 - pulse * 0.2);
    rot(J.head, "x", -trot * 0.04 * Math.sin(2 * a - 1.3) + pulse * 0.22);
    rot(J.jaw, "x", -0.16 - 0.05 * Math.sin(this.clock * 9) - pulse * 0.5); // ofegando; abre ao latir
    // quando para, o rabo abana rápido; trotando, só acompanha o balanço
    const wag = trot > 0.3 ? Math.sin(a - 0.8) * 0.22 : Math.sin(this.clock * 15) * 0.4;
    rot(J.tail1, "y", wag);
    rot(J.tail2, "y", trot > 0.3 ? Math.sin(a - 1.5) * 0.28 : Math.sin(this.clock * 15 - 0.9) * 0.5);
    rot(J.tail1, "x", -0.08 - trot * 0.06 * Math.sin(2 * a - 1.1));

    const onWalk = Math.max(0, Math.min(1, (Math.abs(this.x) - ROAD_W / 2 + 0.2) / 0.4)) * 0.07;
    this.body.position.y = onWalk + this.jumpY;
    this.group.position.set(this.x, 0, -(this.at - dist));
    this.body.rotation.y = this.ry;
  }
}
