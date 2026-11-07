import * as THREE from "three";

/**
 * Gerador do corpo do personagem. Em vez de peças soltas, o corpo é uma superfície contínua e lisa:
 * uma sequência de anéis (como fatias de uma escultura) ligados entre si. Cada anel diz:
 * - largura e profundidade (frente e costas podem ser diferentes: barriga, panturrilha);
 * - anatomia: peitoral, escápulas, coluna, cavidade dos olhos;
 * - quanto cresce ao engordar (vira uma deformação suave do corpo);
 * - a quais ossos pertence (dois ossos no joelho e no cotovelo: dobra sem abrir buraco);
 * - a cor (papel) da faixa até o anel seguinte. Dois anéis na mesma altura formam uma barra de roupa.
 * Poucos anéis-chave são escritos à mão; `smoothRings` cria os intermediários com uma curva suave.
 */

export type Joint =
  | "hips" | "torso" | "head" | "armL" | "armR" | "foreL" | "foreR"
  | "thighL" | "thighR" | "shinL" | "shinR" | "footL" | "footR";

export const JOINTS: readonly Joint[] = [
  "hips", "torso", "head", "armL", "armR", "foreL", "foreR", "thighL", "thighR", "shinL", "shinR", "footL", "footR",
];

export type Role = "skin" | "hair" | "hairLight" | "shirt" | "vest" | "shorts" | "band" | "shoe" | "sole" | "legs" | "white" | "dark" | number;

/** Influência de ossos: [osso, peso] ou dois pares que somam 1. */
export type Weights = [Joint, number][];

export interface Ring {
  y: number; // posição ao longo do eixo do corpo
  x?: number; // centro lateral
  z?: number; // centro frente/trás (negativo = frente)
  rx: number; // meia largura
  rf: number; // meia profundidade na frente
  rb?: number; // meia profundidade atrás (padrão = rf)
  role: Role; // cor da faixa até o próximo anel
  w: Weights;
  fx?: number; ff?: number; fb?: number; // quanto cresce ao engordar (largura, frente, costas)
  sq?: number; // "quadratura": <1 deixa a seção mais quadrada
  sh?: number; // sombra pintada (1 = normal, <1 = mais escuro)
  pec?: number; sca?: number; spine?: number; eye?: number; // anatomia (0 = nenhuma)
}

/** Dados brutos de uma parte, prontos para juntar numa geometria só. */
export interface Part {
  pos: number[];
  fat: number[];
  bones: number[]; // 2 índices por vértice
  wts: number[]; // 2 pesos por vértice
  roles: Role[]; // 1 por vértice
  shade: number[]; // 1 por vértice
  skin?: string; // só aparece nesse visual
  not?: string; // não aparece nesse visual
}

const idx = (j: Joint) => JOINTS.indexOf(j);
const newPart = (skin?: string): Part => ({ pos: [], fat: [], bones: [], wts: [], roles: [], shade: [], skin });

interface RP { p: THREE.Vector3; f: THREE.Vector3 }

const catmull = (a: number, b: number, c: number, d: number, t: number) =>
  0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);

const FIELDS: { k: keyof Ring; def: (r: Ring) => number }[] = [
  { k: "y", def: (r) => r.y }, { k: "x", def: () => 0 }, { k: "z", def: () => 0 }, { k: "rx", def: (r) => r.rx }, { k: "rf", def: (r) => r.rf },
  { k: "rb", def: (r) => r.rf }, { k: "fx", def: () => 0 }, { k: "ff", def: () => 0 }, { k: "fb", def: (r) => r.ff ?? 0 },
  { k: "sq", def: () => 1 }, { k: "sh", def: () => 1 }, { k: "pec", def: () => 0 }, { k: "sca", def: () => 0 }, { k: "spine", def: () => 0 }, { k: "eye", def: () => 0 },
];
const val = (r: Ring, f: (typeof FIELDS)[number]) => (r[f.k] as number | undefined) ?? f.def(r);

function mixWeights(a: Weights, b: Weights, t: number): Weights {
  const m = new Map<Joint, number>();
  for (const [j, w] of a) m.set(j, (m.get(j) ?? 0) + w * (1 - t));
  for (const [j, w] of b) m.set(j, (m.get(j) ?? 0) + w * t);
  const top = [...m.entries()].sort((p, q) => q[1] - p[1]).slice(0, 2);
  const sum = top.reduce((s, e) => s + e[1], 0);
  return top.map(([j, w]) => [j, w / sum]);
}

/** Cria anéis intermediários com curva suave. Barras de roupa (dois anéis na mesma altura) continuam nítidas. */
export function smoothRings(keys: Ring[], sub = 2): Ring[] {
  const out: Ring[] = [];
  let a = 0;
  while (a < keys.length) {
    let b = a;
    while (b + 1 < keys.length && keys[b + 1].y !== keys[b].y) b++;
    for (let i = a; i < b; i++) {
      out.push(keys[i]);
      const p0 = keys[Math.max(i - 1, a)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(i + 2, b)];
      for (let k = 1; k <= sub; k++) {
        const t = k / (sub + 1);
        const r: Ring = { y: 0, rx: 0, rf: 0, role: p1.role, w: mixWeights(p1.w, p2.w, t) };
        for (const f of FIELDS) {
          (r[f.k] as number) = f.k === "sh" || f.k === "sq"
            ? val(p1, f) + (val(p2, f) - val(p1, f)) * t
            : catmull(val(p0, f), val(p1, f), val(p2, f), val(p3, f), t);
        }
        r.rx = Math.max(r.rx, 0.002); r.rf = Math.max(r.rf, 0.002); r.rb = Math.max(r.rb ?? 0, 0.002);
        out.push(r);
      }
    }
    out.push(keys[b]);
    a = b + 1;
  }
  return out;
}

/** Liga anéis numa superfície. axis "y" = ao longo do corpo; "z" = ao longo do pé. */
export function loft(rings: Ring[], o: { seg?: number; axis?: "y" | "z"; capStart?: boolean; capEnd?: boolean; skin?: string; seed?: number } = {}): Part {
  const seg = o.seg ?? 12, axis = o.axis ?? "y", part = newPart(o.skin);
  const gauss = (v: number, m: number, w: number) => Math.exp(-(((v - m) / w) ** 2));
  const pts: RP[][] = rings.map((r) => {
    const out: RP[] = [];
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2 + Math.PI / seg;
      const e = r.sq ?? 1;
      const ca = Math.cos(a), sa = Math.sin(a);
      const c = Math.sign(ca) * Math.pow(Math.abs(ca), e);
      const s = Math.sign(sa) * Math.pow(Math.abs(sa), e);
      const front = Math.max(0, -sa), rear = Math.max(0, sa), side = Math.abs(ca);
      const k = 1
        + (r.pec ?? 0) * gauss(side, 0.5, 0.33) * front // peitoral: dois volumes na frente
        + (r.sca ?? 0) * gauss(side, 0.58, 0.28) * rear // escápulas: dois volumes atrás
        - (r.spine ?? 0) * gauss(ca, 0, 0.16) * rear // sulco da coluna
        - (r.eye ?? 0) * gauss(side, 0.42, 0.16) * front; // cavidade dos olhos
      const d = s < 0 ? r.rf : r.rb ?? r.rf;
      const fd = s < 0 ? r.ff ?? 0 : r.fb ?? r.ff ?? 0;
      const u = c * r.rx * k, v = s * d * k;
      const fu = c * (r.fx ?? 0), fv = s * fd;
      out.push(axis === "y"
        ? { p: new THREE.Vector3((r.x ?? 0) + u, r.y, (r.z ?? 0) + v), f: new THREE.Vector3(fu, 0, fv) }
        : { p: new THREE.Vector3((r.x ?? 0) + u, (r.z ?? 0) - v, r.y), f: new THREE.Vector3(fu, -fv, 0) });
    }
    return out;
  });
  stitch(part, pts, (i) => rings[i].w, (i) => rings[i].role, (i) => rings[i].sh ?? 1, !!o.capStart, !!o.capEnd);
  return part;
}

/** Costura anéis prontos em triângulos virados para fora, com tampas opcionais. */
function stitch(part: Part, pts: RP[][], w: (i: number) => Weights, role: (i: number) => Role, tone: (i: number) => number, capStart: boolean, capEnd: boolean): void {
  const seg = pts[0].length;
  const center = (i: number) => pts[i].reduce((a, b) => a.add(b.p), new THREE.Vector3()).multiplyScalar(1 / seg);
  const tri = (A: [number, number], B: [number, number], C: [number, number], ctr: THREE.Vector3, band: number) => {
    const a = pts[A[0]][A[1]].p, b = pts[B[0]][B[1]].p, c = pts[C[0]][C[1]].p;
    const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    const mid = a.clone().add(b).add(c).multiplyScalar(1 / 3).sub(ctr);
    for (const [i, j] of n.dot(mid) < 0 ? [A, C, B] : [A, B, C]) push(part, pts[i][j], w(i), role(band), tone(i));
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const ctr = center(i).add(center(i + 1)).multiplyScalar(0.5);
    for (let j = 0; j < seg; j++) {
      const k = (j + 1) % seg;
      tri([i, j], [i, k], [i + 1, k], ctr, i);
      tri([i, j], [i + 1, k], [i + 1, j], ctr, i);
    }
  }
  const cap = (i: number, band: number) => {
    const c = center(i), out = c.clone().sub(center(i === 0 ? 1 : i - 1));
    const mid: RP = { p: c, f: pts[i].reduce((a, b) => a.add(b.f), new THREE.Vector3()).multiplyScalar(1 / seg) };
    for (let j = 0; j < seg; j++) {
      const k = (j + 1) % seg, A = pts[i][j], B = pts[i][k];
      const n = new THREE.Vector3().crossVectors(B.p.clone().sub(A.p), c.clone().sub(A.p));
      for (const q of n.dot(out) < 0 ? [B, A, mid] : [A, B, mid]) push(part, q, w(i), role(band), tone(i));
    }
  };
  if (capStart) cap(0, 0);
  if (capEnd) cap(pts.length - 1, pts.length - 2);
}

/** Tubo por um caminho curvo, com raio variável: dedos, mechas de cabelo, sobrancelhas, nariz. */
export function tube(path: [number, number, number][], radii: number[], joint: Joint, role: Role, o: { seg?: number; sub?: number; skin?: string; fat?: [number, number, number]; sh?: number; flat?: number } = {}): Part {
  const seg = o.seg ?? 6, sub = o.sub ?? 2, part = newPart(o.skin);
  const P = path.map((p) => new THREE.Vector3(...p));
  const pts: THREE.Vector3[] = [], rad: number[] = [];
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[Math.max(i - 1, 0)], b = P[i], c = P[i + 1], d = P[Math.min(i + 2, P.length - 1)];
    const ra = radii[Math.max(i - 1, 0)], rb = radii[i], rc = radii[i + 1], rd = radii[Math.min(i + 2, P.length - 1)];
    for (let k = 0; k <= sub; k++) {
      const t = k / (sub + 1);
      pts.push(new THREE.Vector3(catmull(a.x, b.x, c.x, d.x, t), catmull(a.y, b.y, c.y, d.y, t), catmull(a.z, b.z, c.z, d.z, t)));
      rad.push(Math.max(0.0008, catmull(ra, rb, rc, rd, t)));
    }
    if (i === P.length - 2) { pts.push(c.clone()); rad.push(rc); }
  }
  const f = new THREE.Vector3(...(o.fat ?? [0, 0, 0]));
  const T = pts[1].clone().sub(pts[0]).normalize();
  let N = new THREE.Vector3(0, 0, 1).cross(T);
  if (N.lengthSq() < 1e-4) N = new THREE.Vector3(1, 0, 0).cross(T);
  N.normalize();
  const rings: RP[][] = pts.map((c, i) => {
    const t = pts[Math.min(i + 1, pts.length - 1)].clone().sub(pts[Math.max(i - 1, 0)]).normalize();
    N.sub(t.clone().multiplyScalar(N.dot(t))).normalize(); // mantém o "para cima" do tubo sem torcer
    const B = new THREE.Vector3().crossVectors(t, N);
    const ring: RP[] = [];
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      ring.push({ p: c.clone().addScaledVector(N, Math.cos(a) * rad[i]).addScaledVector(B, Math.sin(a) * rad[i] * (o.flat ?? 1)), f: f.clone() });
    }
    return ring;
  });
  const w: Weights = [[joint, 1]];
  stitch(part, rings, () => w, () => role, () => o.sh ?? 1, true, true);
  return part;
}

function push(part: Part, v: RP, w: Weights, role: Role, tone: number): void {
  part.pos.push(v.p.x, v.p.y, v.p.z);
  part.fat.push(v.f.x, v.f.y, v.f.z);
  part.bones.push(idx(w[0][0]), idx((w[1] ?? w[0])[0]));
  part.wts.push(w[0][1], w[1] ? w[1][1] : 0);
  part.roles.push(role);
  part.shade.push(tone);
}

export interface Place {
  x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number; sx?: number; sy?: number; sz?: number;
  fat?: [number, number, number]; // deslocamento ao engordar (acessórios acompanham a barriga)
  sh?: number;
  skin?: string;
}

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P3 = new THREE.Vector3(), S = new THREE.Vector3();

/** Peça rígida presa a um osso (olhos, acessórios). As coordenadas já são as do corpo em repouso. */
export function rigid(g: THREE.BufferGeometry, joint: Joint, role: Role, p: Place = {}): Part {
  const geo = g.index ? g.toNonIndexed() : g;
  E.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0);
  Q.setFromEuler(E);
  M.compose(P3.set(p.x ?? 0, p.y ?? 0, p.z ?? 0), Q, S.set(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1));
  geo.applyMatrix4(M);
  const part = newPart(p.skin), a = geo.attributes.position, f = p.fat ?? [0, 0, 0];
  for (let i = 0; i < a.count; i++) {
    part.pos.push(a.getX(i), a.getY(i), a.getZ(i));
    part.fat.push(f[0], f[1], f[2]);
    part.bones.push(idx(joint), idx(joint));
    part.wts.push(1, 0);
    part.roles.push(role);
    part.shade.push(p.sh ?? 1);
  }
  geo.dispose();
  return part;
}

/** Normais suaves: vértices na mesma posição (dentro de cada parte) dividem a mesma direção de luz. */
function smoothNormals(pos: Float32Array, nor: Float32Array, start: number, end: number): void {
  const acc = new Map<string, [number, number, number]>();
  const key = (i: number) => `${Math.round(pos[i * 3] * 5000)},${Math.round(pos[i * 3 + 1] * 5000)},${Math.round(pos[i * 3 + 2] * 5000)}`;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = start; i < end; i += 3) {
    a.fromArray(pos, i * 3);
    b.fromArray(pos, i * 3 + 3).sub(a);
    c.fromArray(pos, i * 3 + 6).sub(a);
    b.cross(c);
    for (let k = 0; k < 3; k++) {
      const id = key(i + k);
      const n = acc.get(id) ?? [0, 0, 0];
      n[0] += b.x; n[1] += b.y; n[2] += b.z;
      acc.set(id, n);
    }
  }
  for (let i = start; i < end; i++) {
    const n = acc.get(key(i))!;
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    nor[i * 3] = n[0] / l; nor[i * 3 + 1] = n[1] / l; nor[i * 3 + 2] = n[2] / l;
  }
}

/** Junta as partes numa geometria com esqueleto e deformação de "engordar". */
export function assemble(parts: Part[], color: (role: Role, out: THREE.Color) => THREE.Color): { geo: THREE.BufferGeometry; roles: Role[]; shade: Float32Array } {
  const n = parts.reduce((a, p) => a + p.roles.length, 0);
  const pos = new Float32Array(n * 3), fat = new Float32Array(n * 3), col = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), shade = new Float32Array(n);
  const roles: Role[] = new Array(n);
  const c = new THREE.Color();
  let v = 0;
  for (const p of parts) {
    const first = v;
    pos.set(p.pos, v * 3);
    fat.set(p.fat, v * 3);
    for (let i = 0; i < p.roles.length; i++, v++) {
      si[v * 4] = p.bones[i * 2];
      si[v * 4 + 1] = p.bones[i * 2 + 1];
      sw[v * 4] = p.wts[i * 2];
      sw[v * 4 + 1] = p.wts[i * 2 + 1];
      roles[v] = p.roles[i];
      shade[v] = p.shade[i];
      color(p.roles[i], c);
      col[v * 3] = c.r * shade[v];
      col[v * 3 + 1] = c.g * shade[v];
      col[v * 3 + 2] = c.b * shade[v];
    }
    smoothNormals(pos, nor, first, v);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
  geo.morphAttributes.position = [new THREE.BufferAttribute(fat, 3)];
  geo.morphTargetsRelative = true;
  return { geo, roles, shade };
}

