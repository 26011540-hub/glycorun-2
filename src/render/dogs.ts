import * as THREE from "three";
import { seeded } from "./builder";
import { ROAD_W } from "./config";

/**
 * Cachorros do bairro: só cenário, sempre na calçada, sem colisão e sem efeito nas regras.
 * Cada combinação raça + pose é desenhada de uma vez (InstancedMesh). O corpo é feito de anéis, como o
 * do personagem: peito fundo, barriga recolhida, anca, joelho e jarrete nas patas de trás. Cada face tem
 * uma cor só, por isso as manchas de cada raça ficam facetadas. O movimento acontece na placa de vídeo:
 * cada vértice sabe se é pata, rabo ou cabeça.
 */

export type Breed = "caramelo" | "labrador" | "salsicha" | "poodle" | "pastor" | "pinscher" | "fila";
type Pose = "stand" | "sit";
type Part = "body" | "leg" | "head" | "ear" | "tail";
type Ear = "caida" | "pe" | "semi";
type Tail = "foice" | "lontra" | "fino" | "pompom" | "sabre" | "curto" | "grosso";

interface Spec {
  L: number; h: number; d: number; w: number; // meio comprimento, altura na cernelha, fundura do peito, meia largura
  tuck: number; slope?: number; lw: number; // barriga recolhida, queda da garupa, espessura da pata
  hr: number; snout: number; mw: number; neck: number; // cabeça, comprimento e largura do focinho, pescoço
  ear: Ear; earL?: number; tail: Tail; tl: number; flews?: number; // tl: tamanho do rabo; flews: beiço
  coat: number; belly: number; muzzle: number; earC?: number;
  socks?: boolean; tailTip?: boolean; tongue?: boolean; fluffy?: boolean; dewlap?: boolean; brow?: number; iris?: number;
  /** Manchas da raça; y e z da cabeça são relativos ao centro dela. */
  mark?: (part: Part, x: number, y: number, z: number, s: Spec) => number | undefined;
}

const BLACK = 0x2a221c;
const SPECS: Record<Breed, Spec> = {
  caramelo: {
    L: 0.37, h: 0.56, d: 0.23, w: 0.115, tuck: 0.34, lw: 0.036, hr: 0.112, snout: 0.15, mw: 0.062, neck: 0.15,
    ear: "semi", tail: "foice", tl: 0.95, coat: 0xc98a3f, belly: 0xecd2a2, muzzle: 0xe9cc97, earC: 0xa96f30, socks: true, tailTip: true, tongue: true,
    mark: (p, _x, y, z, s) => (p === "body" && z < -s.L * 0.82 && y < s.h - s.d * 0.3 ? s.belly : undefined), // peito claro
  },
  labrador: {
    L: 0.41, h: 0.64, d: 0.29, w: 0.155, tuck: 0.16, lw: 0.045, hr: 0.13, snout: 0.15, mw: 0.083, neck: 0.15,
    ear: "caida", tail: "lontra", tl: 1, coat: 0xe6c88e, belly: 0xf0dfba, muzzle: 0xf0dfbb, earC: 0xd0a868, tongue: true,
  },
  salsicha: {
    L: 0.44, h: 0.3, d: 0.165, w: 0.08, tuck: 0.1, lw: 0.027, hr: 0.082, snout: 0.15, mw: 0.04, neck: 0.1,
    ear: "caida", earL: 1.35, tail: "fino", tl: 0.8, coat: 0x7a3f22, belly: 0x98572f, muzzle: 0x6d3a20, earC: 0x5c2f19,
  },
  poodle: {
    L: 0.25, h: 0.54, d: 0.19, w: 0.09, tuck: 0.46, lw: 0.025, hr: 0.082, snout: 0.13, mw: 0.036, neck: 0.2,
    ear: "caida", tail: "pompom", tl: 0.7, coat: 0xf3efe8, belly: 0xf8f5ef, muzzle: 0xeee7dc, fluffy: true,
  },
  pastor: {
    L: 0.47, h: 0.68, d: 0.29, w: 0.14, tuck: 0.32, slope: 0.09, lw: 0.042, hr: 0.118, snout: 0.19, mw: 0.058, neck: 0.2,
    ear: "pe", earL: 1.1, tail: "sabre", tl: 1, coat: 0xb9823f, belly: 0xd4a766, muzzle: BLACK, earC: BLACK, tongue: true, iris: 0xa87432,
    mark: (p, _x, y, z, s) => {
      if (p === "body" && y > s.h - s.d * 0.46 - (z + s.L) * 0.07 && z > -s.L * 1.02) return BLACK; // manta nas costas
      if (p === "head" && y > s.hr * 0.5 && z > -s.hr * 0.5) return 0x54391f;
      if (p === "tail" && y > s.h - s.d * 0.7) return 0x54391f;
      return undefined;
    },
  },
  pinscher: {
    L: 0.19, h: 0.32, d: 0.13, w: 0.062, tuck: 0.42, lw: 0.016, hr: 0.068, snout: 0.075, mw: 0.03, neck: 0.11,
    ear: "pe", earL: 1.45, tail: "curto", tl: 0.5, coat: 0x241c1a, belly: 0xa8622e, muzzle: 0xa8622e, socks: true, brow: 0xa8622e, iris: 0x7a4a22,
    mark: (p, _x, y, z, s) => (p === "body" && z < -s.L * 0.9 && y < s.h - s.d * 0.42 ? s.belly : undefined), // peito castanho
  },
  fila: {
    L: 0.5, h: 0.76, d: 0.37, w: 0.195, tuck: 0.1, lw: 0.058, hr: 0.175, snout: 0.15, mw: 0.125, neck: 0.13,
    ear: "caida", earL: 0.9, tail: "grosso", tl: 1, flews: 0.5, coat: 0xa97c4b, belly: 0xbc9463, muzzle: BLACK, earC: BLACK, dewlap: true, tongue: true, iris: 0xa87432,
    mark: (p, _x, y, z, s) => (p === "head" && z < -s.hr * 0.42 && y < s.hr * 0.55 ? BLACK : undefined), // máscara
  },
};
const BREEDS = Object.keys(SPECS) as Breed[];
const NOSE = 0x171310, EYE = 0x120e0c, TONGUE = 0xe9899b;

const _c = new THREE.Color();

/** Marca do vértice: pata (sentido e amplitude), rabo, e o ponto (y, z) em torno do qual a peça gira. */
type Tag = readonly [number, number, number, number];
type Paint = number | ((x: number, y: number, z: number) => number);
/** Ponto de um anel: y, z, meia largura, meia altura nos dois lados e, se preciso, x. */
type Pt = readonly [y: number, z: number, rx: number, up: number, dn: number, x?: number];

const STILL: Tag = [0, 0, 0, 0];
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Vector3();

/** Junta faces com cor própria numa só geometria. `m` posiciona o que for adicionado (corpo do cão sentado). */
class Kit {
  readonly m = new THREE.Matrix4();
  private pos: number[] = [];
  private col: number[] = [];
  private tag: number[] = [];
  constructor(private rnd: () => number, private height: number) {}

  private face(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, paint: Paint, tag: Tag | ((p: THREE.Vector3) => Tag)): void {
    _m.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    const hex = typeof paint === "number" ? paint : paint(_m.x, _m.y, _m.z);
    const flat = typeof paint === "number";
    _c.setHex(hex);
    const f = 1 + (this.rnd() - 0.5) * (flat ? 0 : 0.09); // cada face com um tom levemente diferente
    const r = _c.r * f, g = _c.g * f, bl = _c.b * f;
    for (const v of [a, b, c]) {
      _d.copy(v).applyMatrix4(this.m);
      const k = flat ? 1 : 0.85 + 0.22 * Math.min(1, _d.y / this.height); // mais escuro embaixo
      this.pos.push(_d.x, _d.y, _d.z);
      this.col.push(r * k, g * k, bl * k);
      this.tag.push(...(typeof tag === "function" ? tag(_d) : tag));
    }
  }

  /** Superfície que passa por uma sequência de anéis, cada um perpendicular ao caminho. */
  tube(pts: readonly Pt[], paint: Paint, tag: Tag | ((p: THREE.Vector3) => Tag) = STILL, seg = 7): void {
    const rings = pts.map((p, i) => {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)];
      const ty = p1[0] - p0[0], tz = p1[1] - p0[1], len = Math.hypot(ty, tz) || 1;
      const ny = -tz / len, nz = ty / len; // perpendicular ao caminho
      const out: THREE.Vector3[] = [];
      for (let j = 0; j < seg; j++) {
        const a = ((j + 0.5) / seg) * Math.PI * 2, s = Math.sin(a), q = 1 + (this.rnd() - 0.5) * 0.04;
        const v = s * (s > 0 ? p[3] : p[4]) * q;
        out.push(new THREE.Vector3((p[5] ?? 0) + Math.cos(a) * p[2] * q, p[0] + ny * v, p[1] + nz * v));
      }
      return out;
    });
    const center = (r: THREE.Vector3[]) => r.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / seg);
    const out = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ctr: THREE.Vector3) => {
      _n.crossVectors(_a.copy(b).sub(a), _b.copy(c).sub(a));
      const mid = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3).sub(ctr);
      if (_n.dot(mid) < 0) this.face(a, c, b, paint, tag); else this.face(a, b, c, paint, tag);
    };
    for (let i = 0; i < rings.length - 1; i++) {
      const ctr = center(rings[i]).add(center(rings[i + 1])).multiplyScalar(0.5);
      for (let j = 0; j < seg; j++) {
        const k = (j + 1) % seg, A = rings[i][j], B = rings[i][k], C = rings[i + 1][k], D = rings[i + 1][j];
        out(A, B, C, ctr);
        out(A, C, D, ctr);
      }
    }
    for (const [i, o] of [[0, 1], [rings.length - 1, rings.length - 2]] as const) {
      const c = center(rings[i]), inside = center(rings[o]);
      for (let j = 0; j < seg; j++) out(rings[i][j], rings[i][(j + 1) % seg], c, inside);
    }
  }

  ball(r: number, paint: Paint, p: { x?: number; y: number; z: number; sx?: number; sy?: number; sz?: number }, detail = 1, tag: Tag | ((p: THREE.Vector3) => Tag) = STILL): void {
    const g = new THREE.IcosahedronGeometry(r, detail), a = g.attributes.position;
    const at = (i: number) => new THREE.Vector3(a.getX(i) * (p.sx ?? 1) + (p.x ?? 0), a.getY(i) * (p.sy ?? 1) + p.y, a.getZ(i) * (p.sz ?? 1) + p.z);
    for (let i = 0; i < a.count; i += 3) this.face(at(i), at(i + 1), at(i + 2), paint, tag);
    g.dispose();
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("aAnim", new THREE.Float32BufferAttribute(this.tag, 4));
    g.computeVertexNormals();
    return g;
  }
}

const AMP_FRONT = 0.4, AMP_REAR = 0.34; // o desenho reconhece a pata da frente por esta amplitude

function dog(s: Spec, pose: Pose, seed: number): THREE.BufferGeometry {
  const sit = pose === "sit";
  const { L, h: T, d, w, hr, lw, mw } = s;
  const legH = T - d, sl = s.slope ?? 0, fz = -L * 0.76, bz = L * 0.7;
  const k = new Kit(seeded(seed), T + s.neck + hr);

  const paint = (part: Part, oy = 0, oz = 0) => (x: number, y: number, z: number): number => {
    const m = s.mark?.(part, x, y - oy, z - oz, s);
    if (m !== undefined) return m;
    if (part === "body") return y < T - d * 0.74 ? s.belly : s.coat;
    if (part === "leg") return s.socks && y < legH * 0.34 ? s.belly : s.coat;
    if (part === "head") return z - oz < -hr * 0.8 ? s.muzzle : s.coat;
    if (part === "ear") return s.earC ?? s.coat;
    return s.tailTip && Math.abs(z - oz) + Math.abs(y - oy) > s.tl * 0.3 ? s.belly : s.coat;
  };

  // ----- tronco: garupa, lombo, barriga recolhida, peito fundo -----
  const py = d * 0.5 + 0.02, pz = L * 0.5, fold = 0.66; // sentado, o corpo encurta e sobe
  const tilt = sit ? Math.asin(Math.max(0.45, Math.min(0.95, (legH + d * 0.3 - py) / (L * 1.7 * fold)))) : 0;
  if (sit) {
    k.m.makeTranslation(0, py, pz).multiply(new THREE.Matrix4().makeRotationX(tilt)).multiply(new THREE.Matrix4().makeScale(1, 1, fold)).multiply(new THREE.Matrix4().makeTranslation(0, -(T - d * 0.5), -L * 0.9));
  }
  const ring = (zf: number, rx: number, top: number, bot: number): Pt => [(top + bot) / 2, zf * L, rx * w, (top - bot) / 2, (top - bot) / 2];
  k.tube([
    ring(1.08, 0.42, T - d * 0.22 - sl, T - d * 0.7),
    ring(0.9, 0.86, T - d * 0.05 - sl, T - d * 0.92),
    ring(0.6, 0.98, T - d * 0.02 - sl * 0.8, T - d * (1 - s.tuck * 0.9)),
    ring(0.2, 0.9, T - d * 0.03 - sl * 0.4, T - d * (1 - s.tuck)),
    ring(-0.2, 0.96, T - d * 0.02, T - d * (1 - s.tuck * 0.45)),
    ring(-0.6, 1.04, T, T - d),
    ring(-0.92, 0.96, T - d * 0.02, T - d * 0.98),
    ring(-1.12, 0.62, T - d * 0.12, T - d * 0.82),
    ring(-1.22, 0.22, T - d * 0.3, T - d * 0.66),
  ], paint("body"), STILL, 8);
  const X = (y: number, z: number) => new THREE.Vector3(0, y, z).applyMatrix4(k.m);
  const base = X(T - d * 0.3, -L * 0.95), chest = X(T - d * 0.55, fz), rump = X(T - d * 0.3 - sl, L * 1.04);
  if (s.fluffy) k.ball(d * 0.72, s.coat, { y: T - d * 0.42, z: -L * 0.72, sx: 1.05, sz: 1.2 }); // juba do poodle
  k.m.identity();

  // ----- pescoço e cabeça -----
  const hy = base.y + s.neck * 0.98 + hr * 0.25, hz = base.z - s.neck * 0.62 - hr * 0.4;
  const nr = Math.min(w * 0.82, d * 0.42), hn = hr * (s.dewlap ? 0.8 : 0.62);
  k.tube([
    [base.y - nr * 0.2, base.z + nr * 0.5, nr, nr, nr * 1.1],
    [(base.y + hy) / 2, (base.z + hz) / 2 + hr * 0.15, (nr + hn) / 2, (nr + hn) / 2, (nr + hn) / 2],
    [hy - hr * 0.05, hz + hr * 0.3, hn, hn, hn],
  ], s.fluffy ? s.coat : paint("body"), STILL, 7);

  const H: Tag = [0, 0, hy, hz + hr * 0.3]; // a cabeça gira em torno da nuca
  const my = hy - hr * 0.26, tip = hz - hr * 0.82 - s.snout, fl = (s.flews ?? 0) * mw;
  k.tube([
    [hy + hr * 0.02, hz + hr * 0.85, hr * 0.42, hr * 0.42, hr * 0.42],
    [hy + hr * 0.04, hz + hr * 0.42, hr * 0.92, hr * 0.86, hr * 0.82],
    [hy + hr * 0.03, hz - hr * 0.2, hr, hr * 0.92, hr * 0.86],
    [hy - hr * 0.02, hz - hr * 0.66, hr * 0.84, hr * 0.74, hr * 0.74],
    [my, hz - hr * 0.84, mw * 1.14, mw * 0.92 + hr * 0.04, mw * 0.92 + fl],
    [my - mw * 0.05, hz - hr * 0.84 - s.snout * 0.5, mw, mw * 0.76, mw * 0.82 + fl],
    [my - mw * 0.06, tip, mw * 0.86, mw * 0.62, mw * 0.74 + fl * 0.9],
    [my - mw * 0.04, tip - mw * 0.2, mw * 0.46, mw * 0.32, mw * 0.4 + fl * 0.4],
  ], paint("head", hy, hz), H, 8);
  k.ball(mw * 0.4, NOSE, { y: my + mw * 0.42, z: tip - mw * 0.14, sx: 1.2, sy: 0.82 }, 1, H);
  if (s.tongue) k.ball(Math.min(mw * 0.5, 0.04), TONGUE, { y: my - mw * 0.8 - fl * 0.8, z: tip + mw * 0.1, sy: 0.3, sz: 1.5 }, 1, H);
  if (s.dewlap) k.ball(hr * 0.62, s.coat, { y: hy - hr * 0.95, z: hz + hr * 0.15, sx: 0.85, sy: 1.1, sz: 0.85 }, 1); // barbela do fila
  for (const sx of [-1, 1]) {
    const ex = sx * hr * 0.56, ey = hy + hr * 0.19, ez = hz - hr * 0.8;
    // em cara escura, a íris âmbar deixa o olho visível
    if (s.iris) k.ball(hr * 0.15, s.iris, { x: ex, y: ey, z: ez + hr * 0.02 }, 1, H);
    k.ball(hr * (s.iris ? 0.09 : 0.135), EYE, { x: ex, y: ey, z: ez - hr * (s.iris ? 0.08 : 0) }, 1, H);
    k.ball(hr * 0.045, 0xffffff, { x: ex - hr * 0.03, y: ey + hr * 0.05, z: ez - hr * 0.13 }, 0, H);
    if (s.brow) k.ball(hr * 0.1, s.brow, { x: ex * 0.9, y: ey + hr * 0.24, z: ez + hr * 0.04, sy: 0.7 }, 0, H);

    const e = s.earL ?? 1, ec = paint("ear");
    if (s.fluffy) k.ball(hr * 0.56, s.coat, { x: sx * hr * 1.05, y: hy - hr * 0.2, z: hz + hr * 0.05, sx: 0.72, sy: 1.35 }, 1, H);
    else if (s.ear === "caida") k.tube([
      [hy + hr * 0.66, hz + hr * 0.08, hr * 0.1, hr * 0.32, hr * 0.3, sx * hr * 0.72],
      [hy + hr * 0.25, hz + hr * 0.04, hr * 0.13, hr * 0.44, hr * 0.42, sx * hr * 1.0],
      [hy - hr * 0.25 * e, hz, hr * 0.1, hr * 0.36, hr * 0.34, sx * hr * 1.08],
      [hy - hr * 0.62 * e, hz - hr * 0.02, hr * 0.05, hr * 0.1, hr * 0.1, sx * hr * 1.08],
    ], ec, H, 6);
    else if (s.ear === "pe") k.tube([
      [hy + hr * 0.52, hz + hr * 0.2, hr * 0.36, hr * 0.11, hr * 0.11, sx * hr * 0.54],
      [hy + hr * 0.98 * e, hz + hr * 0.22, hr * 0.23, hr * 0.08, hr * 0.08, sx * hr * 0.66],
      [hy + hr * 1.5 * e, hz + hr * 0.24, hr * 0.02, hr * 0.02, hr * 0.02, sx * hr * 0.78],
    ], ec, H, 5);
    else k.tube([
      [hy + hr * 0.52, hz + hr * 0.15, hr * 0.32, hr * 0.1, hr * 0.1, sx * hr * 0.6],
      [hy + hr * 0.92, hz + hr * 0.14, hr * 0.22, hr * 0.08, hr * 0.08, sx * hr * 0.82],
      [hy + hr * 0.84, hz + hr * 0.08, hr * 0.13, hr * 0.06, hr * 0.06, sx * hr * 1.1],
      [hy + hr * 0.58, hz + hr * 0.02, hr * 0.02, hr * 0.02, hr * 0.02, sx * hr * 1.26],
    ], ec, H, 5);
  }
  if (s.fluffy) {
    k.ball(hr * 0.86, s.coat, { y: hy + hr * 0.72, z: hz + hr * 0.15, sy: 0.9, sz: 1.1 }, 1, H); // topete
  }

  // ----- patas: pares diagonais andam juntos -----
  const paw = (x: number, z: number, tag: Tag) => {
    k.ball(lw * 1.14, paint("leg"), { x, y: lw * 0.72, z: z - lw * 0.5, sy: 0.72, sz: 1.45 }, 1, tag);
    if (s.fluffy) k.ball(lw * 2.4, s.coat, { x, y: legH * 0.26, z, sy: 1.15 }, 1, tag); // pompom da pata
  };
  for (const sx of [-1, 1]) {
    const x = sx * w * 0.68, top = sit ? chest.y : T - d * 0.28, zf = sit ? chest.z : fz;
    const tag: Tag = sit ? STILL : [sx * AMP_FRONT, 0, top, zf];
    const span = sit ? chest.y - d * 0.4 : legH;
    k.tube([
      [top, zf, lw * 1.25, lw * 1.7, lw * 1.7, x],
      [span + d * 0.12, zf + 0.01, lw * 1.2, lw * 1.35, lw * 1.35, x],
      [span * 0.72, zf + 0.015, lw * 0.95, lw * 0.98, lw * 0.98, x],
      [span * 0.3, zf, lw * 0.78, lw * 0.8, lw * 0.8, x],
      [span * 0.13, zf - 0.008, lw * 0.76, lw * 0.8, lw * 0.8, x],
      [lw * 0.7, zf - 0.018, lw * 0.95, lw * 1.05, lw * 1.05, x],
    ], paint("leg"), tag, 6);
    paw(x, zf - 0.018, tag);
  }
  for (const sx of [-1, 1]) {
    const x = sx * w * 0.72;
    if (sit) {
      // sentado: coxa dobrada ao lado do corpo, com a pata à frente dela
      const hx = sx * w * 0.92;
      k.ball(d * 0.44, s.mark ? paint("body") : s.coat, { x: hx, y: d * 0.4, z: pz + L * 0.08, sx: 0.5, sy: 0.95, sz: 1.15 });
      k.tube([
        [d * 0.26, pz - d * 0.1, lw * 1.1, lw * 1.2, lw * 1.2, hx],
        [lw * 1.1, pz - d * 0.5, lw * 0.85, lw * 0.9, lw * 0.9, hx],
        [lw * 0.8, pz - d * 0.86, lw * 0.9, lw * 0.9, lw * 0.9, hx],
      ], paint("leg"), STILL, 6);
      paw(hx, pz - d * 0.86, STILL);
      continue;
    }
    const tag: Tag = [-sx * AMP_REAR, 0, T - d * 0.2 - sl, bz];
    k.tube([
      [T - d * 0.16 - sl, bz - 0.02, lw * 1.5, lw * 2.4, lw * 2.2, x],
      [legH + d * 0.1, bz, lw * 1.4, lw * 2.1, lw * 1.9, x],
      [legH * 0.68, bz + legH * 0.1, lw * 0.98, lw * 1.1, lw * 1.15, x],
      [legH * 0.36, bz + legH * 0.22, lw * 0.74, lw * 0.74, lw * 0.8, x], // jarrete, o "calcanhar" para trás
      [legH * 0.16, bz + legH * 0.12, lw * 0.72, lw * 0.74, lw * 0.74, x],
      [lw * 0.7, bz + legH * 0.08, lw * 0.92, lw * 1, lw * 1, x],
    ], paint("leg"), tag, 6);
    paw(x, bz + legH * 0.08, tag);
  }

  // ----- rabo -----
  const shapes: Record<Tail, readonly (readonly [number, number, number])[]> = {
    foice: [[0, 0, 0.042], [0.13, 0.08, 0.04], [0.25, 0.08, 0.034], [0.32, -0.01, 0.012]],
    lontra: [[0, 0, 0.066], [-0.06, 0.16, 0.058], [-0.11, 0.3, 0.04], [-0.1, 0.42, 0.012]],
    fino: [[0, 0, 0.03], [0.02, 0.14, 0.022], [0.07, 0.28, 0.015], [0.13, 0.38, 0.006]],
    pompom: [[0, 0, 0.022], [0.14, 0.06, 0.018], [0.26, 0.08, 0.014]],
    sabre: [[0, 0, 0.05], [-0.15, 0.09, 0.07], [-0.3, 0.14, 0.07], [-0.38, 0.22, 0.02]],
    curto: [[0, 0, 0.03], [0.07, 0.04, 0.026], [0.13, 0.05, 0.012]],
    grosso: [[0, 0, 0.076], [-0.13, 0.13, 0.062], [-0.24, 0.22, 0.044], [-0.26, 0.34, 0.014]],
  };
  const pts = sit ? [[0, 0, 0.05], [-0.02, 0.12, 0.04], [-0.03, 0.22, 0.028], [0, 0.3, 0.01]] as const : shapes[s.tail];
  const ty = sit ? d * 0.14 : rump.y, tz = sit ? pz + L * 0.42 : rump.z, tl = s.tl;
  const len = Math.hypot(pts[pts.length - 1][0], pts[pts.length - 1][1]) * tl;
  const wagTag = (p: THREE.Vector3): Tag => [0, Math.min(1, Math.hypot(p.y - ty, p.z - tz) / len) * len * 0.5, 0, 0];
  k.tube(pts.map(([y, z, r]) => [ty + y * tl, tz + z * tl, r * tl, r * tl, r * tl] as const), paint("tail", ty, tz), wagTag, 6);
  if (s.tail === "pompom" && !sit) k.ball(0.075, s.coat, { y: ty + 0.26 * tl, z: tz + 0.08 * tl }, 1, wagTag);

  return k.build();
}

interface Dog { key: string; x: number; z: number; ry: number; walk: boolean; wag: number; phase: number; z0: number; barked: boolean; breed: Breed }
interface Kind { mesh: THREE.InstancedMesh; anim: THREE.InstancedBufferAttribute; count: number; freq: number }

const CHUNK = 20, HALF = ROAD_W / 2, CAP = 6, SHADOWS = 24, SCALE = 1.2;
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), S = new THREE.Vector3(SCALE, SCALE, SCALE), SS = new THREE.Vector3();
const ease = (t: number) => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };

export class Dogs {
  readonly group = new THREE.Group();
  /** Falso na qualidade baixa: menos cachorros. */
  rich = true;
  onBark: (() => void) | null = null;
  private time = { value: 0 };
  private mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private kinds = new Map<string, Kind>();
  private chunks = new Map<number, Dog[]>();
  private barkWait = 0;
  private shadows = new THREE.InstancedMesh(
    new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false }),
    SHADOWS,
  );

  constructor() {
    const time = this.time;
    this.mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time;
      sh.vertexShader = "attribute vec4 aAnim;\nattribute vec4 aInst;\nuniform float uTime;\n" + sh.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float walk = aInst.y;
        float ph = (uTime + aInst.x) * aInst.w;
        if (aAnim.x != 0.0) {
          // pata: gira no ombro ou na anca; a da frente sai um pouco antes, e o pé sobe ao voltar para a frente
          float side = sign(aAnim.x), amp = abs(aAnim.x);
          float g = ph + (amp > 0.37 ? 0.32 : 0.0);
          float th = side * amp * walk * sin(g);
          float c = cos(th), s = sin(th);
          vec2 q = transformed.yz - aAnim.zw;
          transformed.y = aAnim.z + q.x * c - q.y * s;
          transformed.z = aAnim.w + q.x * s + q.y * c;
          float t = clamp(-q.x / aAnim.z, 0.0, 1.0);
          float up = max(0.0, side * cos(g)) * walk * t * t * aAnim.z;
          transformed.y += up * 0.2;
          transformed.z += up * 0.12;
        } else {
          transformed.y += abs(sin(ph)) * 0.012 * walk; // o corpo sobe e desce a cada passo
          if (aAnim.z > 0.0) {
            // cabeça: parado, olha em volta devagar; andando, acompanha o passo
            float yaw = sin(uTime * 0.7 + aInst.x * 3.0) * 0.32 * (1.0 - walk);
            float c = cos(yaw), s = sin(yaw), z0 = transformed.z - aAnim.w, x0 = transformed.x;
            transformed.x = x0 * c + z0 * s;
            transformed.z = aAnim.w + z0 * c - x0 * s;
            transformed.y += sin(ph * 2.0 - 0.8) * 0.008 * walk;
          }
        }
        // rabo: a ponta vem depois da base
        transformed.x += aAnim.y * sin(uTime * 15.0 + aInst.x - aAnim.y * 9.0) * 0.55 * aInst.z;`,
      );
    };
    this.shadows.frustumCulled = false;
    this.shadows.count = 0;
    this.group.add(this.shadows);
  }

  private kind(key: string): Kind {
    let k = this.kinds.get(key);
    if (k) return k;
    const [breed, pose] = key.split(":") as [Breed, Pose];
    const spec = SPECS[breed];
    const geo = dog(spec, pose, BREEDS.indexOf(breed) * 31 + 5);
    const anim = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aInst", anim);
    const mesh = new THREE.InstancedMesh(geo, this.mat, CAP);
    mesh.frustumCulled = false;
    mesh.count = 0;
    this.group.add(mesh);
    // pata curta dá passo mais rápido, para o pé não escorregar na calçada
    k = { mesh, anim, count: 0, freq: Math.max(4, Math.min(10, 1.2 / (spec.h - spec.d * 0.5))) };
    this.kinds.set(key, k);
    return k;
  }

  /** Monta todos os modelos de uma vez, no menu, para nenhum atrasar a corrida. */
  prewarm(): void {
    for (const b of BREEDS) for (const p of ["stand", "sit"]) {
      const k = this.kind(`${b}:${p}`);
      k.mesh.count = 1;
      k.mesh.visible = true;
      k.mesh.setMatrixAt(0, M.makeTranslation(0, 500, 0));
    }
    this.shadows.count = 1;
    this.shadows.setMatrixAt(0, M.makeTranslation(0, 500, 0));
  }

  private spawn(i: number): Dog[] {
    const r = seeded((i + 1000) * 2654435 + 977), a = i * CHUNK, out: Dog[] = [];
    for (let k = 0; k < 4; k++) r(); // descarta os primeiros números: blocos vizinhos ficam bem diferentes
    const first = i === 1; // um caramelo logo no começo da corrida
    if (!first && r() > (this.rich ? 0.38 : 0.14)) return out;
    const side = first || r() < 0.5 ? 1 : -1;
    const breed: Breed = first || r() < 0.34 ? "caramelo" : BREEDS[Math.floor(r() * BREEDS.length)];
    const p = first ? 0 : r();
    const walk = p > 0.62;
    const x = side * (HALF + 1.05 + r() * 0.8);
    const z = a + 11.3 + r() * 1.5; // trecho livre da calçada em todos os bairros
    const road = side > 0 ? -Math.PI / 2 : Math.PI / 2; // virado para a rua
    out.push({
      key: `${breed}:${p < 0.34 ? "sit" : "stand"}`, x, z, z0: z, ry: walk ? 0 : road + (r() - 0.5) * 0.8, walk,
      wag: walk ? 0.5 : 1, phase: r() * 10, barked: false, breed,
    });
    return out;
  }

  update(dist: number, dt: number, ahead: number, running: boolean): void {
    this.group.position.z = dist;
    this.time.value += dt;
    this.barkWait = Math.max(0, this.barkWait - dt);
    const first = Math.floor((dist - 16) / CHUNK), last = Math.floor((dist + ahead) / CHUNK);
    for (const i of this.chunks.keys()) if (i < first || i > last) this.chunks.delete(i);
    for (let i = first; i <= last; i++) if (!this.chunks.has(i)) this.chunks.set(i, this.spawn(i));

    for (const k of this.kinds.values()) k.count = 0;
    let shade = 0;
    for (const list of this.chunks.values()) {
      for (const d of list) {
        const k = this.kind(d.key);
        if (k.count >= CAP) continue;
        let z = d.z, ry = d.ry, walk = 0;
        if (d.walk) {
          // passeia para a frente e para trás num trecho curto: freia, vira devagar e volta
          const u = ((this.time.value * 0.2 + d.phase) % 2 + 2) % 2, v = u < 0.5 ? u + 2 : u;
          z = d.z0 - Math.cos(Math.PI * u) * 0.9;
          ry = v < 1.5 ? Math.PI * ease((v - 0.88) / 0.24) : Math.PI + Math.PI * ease((v - 1.88) / 0.24);
          walk = Math.min(1, Math.abs(Math.sin(Math.PI * u)) * 3.5 + 0.25);
        }
        Q.setFromAxisAngle(Y, ry);
        M.compose(P.set(d.x, 0.07, -z), Q, S);
        k.mesh.setMatrixAt(k.count, M);
        k.anim.setXYZW(k.count, d.phase, walk, d.wag, k.freq);
        k.count++;
        if (shade < SHADOWS) {
          const sp = SPECS[d.breed];
          M.compose(P.set(d.x, 0.082, -z), Q, SS.set(sp.w * 1.9 * SCALE, 1, sp.L * 1.45 * SCALE));
          this.shadows.setMatrixAt(shade++, M);
        }
        const near = z - dist;
        if (running && !d.barked && near > 2 && near < 11) {
          d.barked = true;
          if (this.barkWait <= 0 && Math.abs(d.phase % 1) < 0.4) { this.barkWait = 5; this.onBark?.(); }
        }
      }
    }
    this.shadows.count = shade;
    this.shadows.instanceMatrix.needsUpdate = true;
    for (const k of this.kinds.values()) {
      k.mesh.count = k.count;
      k.mesh.visible = k.count > 0;
      k.mesh.instanceMatrix.needsUpdate = true;
      k.anim.needsUpdate = true;
    }
  }
}
