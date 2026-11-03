import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { SkinId } from "../content/texts";
import { textTexture } from "./builder";

/**
 * Personagem original do GlycoRun 2, montado em código (low-poly, proporções próximas do real: ~7,5 cabeças).
 * Ele corre para -z (de costas para a câmera). Altura ~1,77.
 * O corpo alarga com condicionamento baixo (decisão do autor) por escala suave do tronco, barriga, quadril e membros.
 *
 * Desempenho: as peças de cada articulação são juntadas numa só malha com cores por vértice
 * (~18 chamadas de desenho para o personagem inteiro).
 */

type Joint = "hips" | "torso" | "head" | "armL" | "armR" | "foreL" | "foreR" | "thighL" | "thighR" | "shinL" | "shinR" | "footL" | "footR";

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
type Role = "skin" | "hair" | "shirt" | "shorts" | "shoe" | "sole" | "legs" | "white" | "dark" | number;
const SKIN_TONE = 0x9a6847;
const HAIR = 0x261a14;
interface Outfit { shirt: number; shorts: number; shoe: number; sole: number; legs?: number }
const OUTFIT: Record<SkinId, Outfit> = {
  corredor: { shirt: 0x2f7fe0, shorts: 0x22324a, shoe: 0xb6ff3b, sole: 0xff4f8b },
  fone: { shirt: 0x6f55e0, shorts: 0x2a2f45, shoe: 0xf4f4f4, sole: 0x6f55e0 },
  mochila: { shirt: 0xf08a3c, shorts: 0x22324a, shoe: 0xf4f4f4, sole: 0xe2483d },
  acs: { shirt: 0xe9f1fa, shorts: 0x3a4a63, shoe: 0x2e2a28, sole: 0x111111, legs: 0x3a4a63 },
};
const HYPER_SHIRT = new THREE.Color(0xe46a4f);

// Classes de "engordar": quanto cada peça alarga (x, z) e cresce (y) com fat = 1
type FatClass = "none" | "torso" | "belly" | "pelvis" | "limb" | "back";
const FAT: Record<FatClass, [number, number, number]> = {
  none: [0, 0, 0], torso: [0.28, 0.5, 0], belly: [0.45, 0.55, 0.3], pelvis: [0.35, 0.45, 0], limb: [0.4, 0.4, 0], back: [0, 0, 0],
};

interface Part { joint: Joint; geo: THREE.BufferGeometry; role: Role; fat: FatClass; skin?: SkinId }
interface Place { x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number; sx?: number; sy?: number; sz?: number }

const MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

/** Cilindro com o topo na origem, crescendo para baixo (segmento de membro). */
function limbGeo(rTop: number, rBot: number, len: number, seg = 7): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, seg);
  g.translate(0, -len / 2, 0);
  return g;
}

export class Character {
  readonly root = new THREE.Group();
  private j = {} as Record<Joint, THREE.Group>;
  private parts: Part[] = [];
  private meshes: { mesh: THREE.Mesh; fat: FatClass; ranges: { start: number; count: number; role: Role }[] }[] = [];
  private skin: SkinId = "corredor";
  private shirtTint = -1;
  private fatNow = 0;
  private label: THREE.Mesh;
  private shoulders: THREE.Group[] = [];
  private hipJoints: THREE.Group[] = [];
  private pose: Pose = { ...STAND };
  private target: Pose = { ...STAND };
  private phase = 0;
  private hitT = 0;
  private cheerT = 0;
  private flipT = 0;
  private time = 0;

  constructor() {
    this.buildSkeleton();
    this.buildParts();
    // rótulo "ACS" nas costas do colete (textura, malha à parte)
    this.label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.08),
      new THREE.MeshBasicMaterial({ map: textTexture("ACS", { w: 128, h: 48, fg: "#ffffff" }), transparent: true }),
    );
    this.label.position.set(0, 0.3, 0.135);
    this.j.torso.add(this.label);
    this.setSkin("corredor");
    this.setFat(0.85);
  }

  private joint(name: Joint, parent: THREE.Object3D, x: number, y: number, z = 0): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    this.j[name] = g;
    return g;
  }

  private buildSkeleton(): void {
    const hips = this.joint("hips", this.root, 0, HIP_Y);
    for (const side of [-1, 1] as const) {
      const L = side < 0 ? "L" : "R";
      const thigh = this.joint(`thigh${L}`, hips, side * 0.09, -0.05);
      this.hipJoints.push(thigh);
      const shin = this.joint(`shin${L}`, thigh, 0, -0.44);
      this.joint(`foot${L}`, shin, 0, -0.42);
    }
    const torso = this.joint("torso", hips, 0, 0.06);
    this.joint("head", torso, 0, 0.6);
    for (const side of [-1, 1] as const) {
      const L = side < 0 ? "L" : "R";
      const arm = this.joint(`arm${L}`, torso, side * 0.205, 0.42);
      this.shoulders.push(arm);
      this.joint(`fore${L}`, arm, 0, -0.28);
    }
  }

  /** Registra uma peça (geometria já posicionada no espaço da articulação). */
  private p(joint: Joint, g: THREE.BufferGeometry, role: Role, at: Place = {}, fat: FatClass = "none", skin?: SkinId): void {
    const geo = g.index ? g.toNonIndexed() : g;
    geo.deleteAttribute("uv");
    _e.set(at.rx ?? 0, at.ry ?? 0, at.rz ?? 0);
    _q.setFromEuler(_e);
    _m.compose(_p.set(at.x ?? 0, at.y ?? 0, at.z ?? 0), _q, _s.set(at.sx ?? 1, at.sy ?? 1, at.sz ?? 1));
    geo.applyMatrix4(_m);
    this.parts.push({ joint, geo, role, fat, skin });
  }

  private buildParts(): void {
    const S = THREE.SphereGeometry, B = THREE.BoxGeometry, Cy = THREE.CylinderGeometry, To = THREE.TorusGeometry;
    // quadril / short
    this.p("hips", new Cy(0.15, 0.16, 0.2, 8), "shorts", { y: -0.02, sz: 0.72 }, "pelvis");
    for (const L of ["L", "R"] as const) {
      this.p(`thigh${L}`, limbGeo(0.078, 0.06, 0.44), "legs", {}, "limb");
      this.p(`thigh${L}`, limbGeo(0.088, 0.08, 0.2), "shorts", {}, "limb");
      this.p(`shin${L}`, new S(0.06, 7, 5), "legs");
      this.p(`shin${L}`, limbGeo(0.058, 0.04, 0.42), "legs");
      this.p(`foot${L}`, new B(0.095, 0.07, 0.23), "shoe", { y: -0.025, z: -0.05 });
      this.p(`foot${L}`, new B(0.1, 0.028, 0.24), "sole", { y: -0.07, z: -0.05 });
      this.p(`foot${L}`, new B(0.07, 0.02, 0.12), "white", { y: 0.015, z: -0.1 });
    }
    // tronco
    this.p("torso", new Cy(0.19, 0.145, 0.44, 8), "shirt", { y: 0.22, sz: 0.62 }, "torso");
    this.p("torso", new S(0.13, 9, 7), "shirt", { y: 0.11, z: 0, sx: 1.05, sz: 0.78, sy: 1.0 }, "belly");
    this.p("torso", new Cy(0.05, 0.055, 0.08, 7), "skin", { y: 0.48 });
    // cabeça
    this.p("head", new S(0.115, 10, 8), "skin", { y: 0.02, sx: 0.92, sy: 1.08 });
    this.p("head", new S(0.122, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), "hair", { y: 0.035, z: 0.008, sx: 0.96, sy: 1.05, sz: 1.04 });
    this.p("head", new B(0.2, 0.08, 0.06), "hair", { y: -0.005, z: 0.085 });
    for (const s of [-1, 1]) {
      this.p("head", new S(0.025, 6, 5), "skin", { x: s * 0.108, y: 0.01 });
      this.p("head", new S(0.017, 6, 5), "dark", { x: s * 0.04, y: 0.03, z: -0.108 });
      this.p("head", new B(0.04, 0.008, 0.01), "hair", { x: s * 0.04, y: 0.063, z: -0.108, rz: s * -0.12 });
    }
    this.p("head", new THREE.ConeGeometry(0.018, 0.04, 5), "skin", { z: -0.12, rx: -Math.PI / 2 });
    // braços
    for (const L of ["L", "R"] as const) {
      this.p(`arm${L}`, new S(0.056, 8, 6), "shirt");
      this.p(`arm${L}`, limbGeo(0.052, 0.042, 0.28), "skin", {}, "limb");
      this.p(`arm${L}`, limbGeo(0.064, 0.058, 0.12), "shirt", {}, "limb");
      this.p(`fore${L}`, limbGeo(0.042, 0.034, 0.25), "skin");
      this.p(`fore${L}`, new S(0.042, 7, 5), "skin", { y: -0.28 });
    }
    // sensor de glicose (CGM) atrás do braço esquerdo
    this.p("armL", new Cy(0.03, 0.03, 0.012, 10), "white", { y: -0.17, z: 0.05, rx: Math.PI / 2 }, "limb");

    // ----- acessórios de cada visual -----
    // Corredor: faixa de cabeça
    this.p("head", new To(0.114, 0.014, 5, 16), 0xff4f8b, { y: 0.085, rx: Math.PI / 2 + 0.12 }, "none", "corredor");
    this.p("head", new B(0.03, 0.09, 0.012), 0xff4f8b, { x: 0.02, y: 0.03, z: 0.125, rx: 0.3, rz: 0.3 }, "none", "corredor");
    // Fone de ouvido
    this.p("head", new To(0.135, 0.016, 5, 14, Math.PI), 0x2b2250, { y: 0.02 }, "none", "fone");
    for (const s of [-1, 1]) this.p("head", new Cy(0.048, 0.048, 0.035, 10), 0x5a43c8, { x: s * 0.122, rz: Math.PI / 2 }, "none", "fone");
    // Mochila de hidratação nas costas (+z, visível para a câmera)
    this.p("torso", new B(0.26, 0.32, 0.09), 0x18a37a, { y: 0.27, z: 0.14 }, "back", "mochila");
    this.p("torso", new B(0.16, 0.18, 0.02), 0x7fd0ff, { y: 0.29, z: 0.19 }, "back", "mochila");
    this.p("torso", new To(0.09, 0.008, 4, 10, Math.PI), 0x2b6f8f, { x: 0.13, y: 0.4, z: 0.12, ry: Math.PI / 2 }, "back", "mochila");
    for (const s of [-1, 1]) this.p("torso", new B(0.03, 0.36, 0.03), 0x0f5e47, { x: s * 0.1, y: 0.27, z: -0.07 }, "torso", "mochila");
    // ACS: colete, boné e bolsa de visita
    this.p("torso", new Cy(0.2, 0.16, 0.38, 8), 0x1f5fa8, { y: 0.24, sz: 0.66 }, "torso", "acs");
    this.p("head", new S(0.125, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), 0x1f5fa8, { y: 0.05 }, "none", "acs");
    this.p("head", new B(0.17, 0.012, 0.11), 0x1f5fa8, { y: 0.055, z: -0.15 }, "none", "acs");
    this.p("torso", new B(0.06, 0.16, 0.2), 0x8a5a3b, { x: -0.21, y: 0.02 }, "torso", "acs");
    this.p("torso", new B(0.025, 0.55, 0.02), 0x8a5a3b, { y: 0.25, z: 0.125, rz: 0.62 }, "back", "acs");
  }

  private color(role: Role, out: THREE.Color): THREE.Color {
    if (typeof role === "number") return out.setHex(role);
    const o = OUTFIT[this.skin];
    const map: Record<Exclude<Role, number>, number> = {
      skin: SKIN_TONE, hair: HAIR, shirt: o.shirt, shorts: o.shorts, shoe: o.shoe, sole: o.sole,
      legs: o.legs ?? SKIN_TONE, white: 0xf4f6f8, dark: 0x1b1b1f,
    };
    return out.setHex(map[role]);
  }

  /** Junta as peças de cada articulação (por classe de engordar) numa malha só. */
  private rebuild(): void {
    for (const r of this.meshes) { r.mesh.removeFromParent(); r.mesh.geometry.dispose(); }
    this.meshes = [];
    const groups = new Map<string, Part[]>();
    for (const part of this.parts) {
      if (part.skin && part.skin !== this.skin) continue;
      const k = `${part.joint}|${part.fat}`;
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(part);
    }
    const c = new THREE.Color();
    for (const [k, list] of groups) {
      const geo = mergeGeometries(list.map((x) => x.geo))!;
      const col = new Float32Array(geo.attributes.position.count * 3);
      const ranges: { start: number; count: number; role: Role }[] = [];
      let start = 0;
      for (const part of list) {
        const n = part.geo.attributes.position.count;
        this.color(part.role, c);
        for (let i = start; i < start + n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        ranges.push({ start, count: n, role: part.role });
        start += n;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const mesh = new THREE.Mesh(geo, MAT);
      const [joint, fat] = k.split("|") as [Joint, FatClass];
      this.j[joint].add(mesh);
      this.meshes.push({ mesh, fat, ranges });
    }
    this.shirtTint = -1;
    this.setFat(this.fatNow);
  }

  setSkin(skin: SkinId): void {
    this.skin = skin;
    this.label.visible = skin === "acs";
    this.rebuild();
  }

  /** fat: 0 = bem condicionado, 1 = sedentário. Muda a largura de forma suave. */
  setFat(fat: number): void {
    this.fatNow = fat;
    for (const r of this.meshes) {
      const [x, z, y] = FAT[r.fat];
      r.mesh.scale.set(1 + x * fat, 1 + y * fat, 1 + z * fat);
      // mochila e alças das costas acompanham a barriga/peito sem deformar
      r.mesh.position.z = r.fat === "back" ? 0.06 * fat : 0;
    }
    this.shoulders.forEach((s, i) => (s.position.x = (i ? 1 : -1) * 0.205 * (1 + 0.22 * fat)));
    this.hipJoints.forEach((h, i) => (h.position.x = (i ? 1 : -1) * 0.09 * (1 + 0.25 * fat)));
    this.label.position.z = 0.135 + 0.065 * fat;
  }

  /** Camisa avermelhada na hiperglicemia (como no original). Só reescreve as cores quando mudam. */
  private tintShirt(amount: number): void {
    const q = Math.round(amount * 20) / 20;
    if (q === this.shirtTint) return;
    this.shirtTint = q;
    const c = new THREE.Color(OUTFIT[this.skin].shirt).lerp(HYPER_SHIRT, q);
    for (const r of this.meshes) {
      let touched = false;
      const col = r.mesh.geometry.attributes.color as THREE.BufferAttribute;
      for (const g of r.ranges) {
        if (g.role !== "shirt") continue;
        for (let i = g.start; i < g.start + g.count; i++) col.setXYZ(i, c.r, c.g, c.b);
        touched = true;
      }
      if (touched) col.needsUpdate = true;
    }
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
