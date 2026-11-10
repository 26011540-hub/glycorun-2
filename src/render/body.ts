import * as THREE from "three";
import { seeded } from "./builder";

/**
 * Gerador do corpo do personagem. Em vez de peças soltas, o corpo é uma superfície contínua:
 * uma sequência de anéis (como fatias de uma escultura) ligados entre si. Cada anel diz:
 * - largura e profundidade (frente e costas podem ser diferentes: barriga, panturrilha);
 * - quanto cresce ao engordar (vira uma deformação suave, sem esticar a roupa toda);
 * - a quais ossos pertence (dois ossos no joelho e no cotovelo: dobra sem abrir buraco);
 * - a cor (papel) da faixa até o anel seguinte. Dois anéis na mesma altura formam uma barra de roupa.
 */

export type Joint =
  | "hips" | "torso" | "head" | "armL" | "armR" | "foreL" | "foreR"
  | "thighL" | "thighR" | "shinL" | "shinR" | "footL" | "footR"
  | "neck" | "jaw" | "tail1" | "tail2"; // só o Dr. Bruce usa estes

export const JOINTS: readonly Joint[] = [
  "hips", "torso", "head", "armL", "armR", "foreL", "foreR", "thighL", "thighR", "shinL", "shinR", "footL", "footR",
];
export const ALL_JOINTS: readonly Joint[] = [...JOINTS, "neck", "jaw", "tail1", "tail2"];

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
  sq?: number; // "quadratura": <1 deixa a seção mais quadrada (peito, quadril)
  sh?: number; // sombra pintada (1 = normal, <1 = mais escuro)
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
}

const idx = (j: Joint) => ALL_JOINTS.indexOf(j);
const newPart = (skin?: string): Part => ({ pos: [], fat: [], bones: [], wts: [], roles: [], shade: [], skin });

interface RP { p: THREE.Vector3; f: THREE.Vector3 }

/** Liga anéis numa superfície. axis "y" = ao longo do corpo; "z" = ao longo do pé. */
export function loft(rings: Ring[], o: { seg?: number; axis?: "y" | "z"; capStart?: boolean; capEnd?: boolean; skin?: string; seed?: number; jitter?: number } = {}): Part {
  const seg = o.seg ?? 8, axis = o.axis ?? "y", part = newPart(o.skin);
  const rnd = seeded(o.seed ?? 7), jit = o.jitter ?? 0.018;
  const pts: RP[][] = rings.map((r) => {
    const out: RP[] = [];
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2 + Math.PI / seg;
      const e = r.sq ?? 1;
      const c = Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), e);
      const s = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), e);
      const k = 1 + (rnd() - 0.5) * 2 * jit; // pequena irregularidade: aparência de modelo feito à mão
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
  const center = (i: number) => pts[i].reduce((a, b) => a.add(b.p), new THREE.Vector3()).multiplyScalar(1 / seg);

  const tri = (a: [number, number], b: [number, number], c: [number, number], ctr: THREE.Vector3, band: number) => {
    const A = pts[a[0]][a[1]].p, B = pts[b[0]][b[1]].p, C = pts[c[0]][c[1]].p;
    const n = new THREE.Vector3().crossVectors(B.clone().sub(A), C.clone().sub(A));
    const mid = A.clone().add(B).add(C).multiplyScalar(1 / 3).sub(ctr);
    const list = n.dot(mid) < 0 ? [a, c, b] : [a, b, c]; // sempre virado para fora
    const tone = (rings[band].sh ?? 1) * (1 + (rnd() - 0.5) * 0.07); // cada face com um tom levemente diferente
    for (const [i, j] of list) push(part, pts[i][j], rings[i].w, rings[band].role, tone);
  };

  for (let i = 0; i < rings.length - 1; i++) {
    const ctr = center(i).add(center(i + 1)).multiplyScalar(0.5);
    for (let j = 0; j < seg; j++) {
      const k = (j + 1) % seg;
      tri([i, j], [i, k], [i + 1, k], ctr, i);
      tri([i, j], [i + 1, k], [i + 1, j], ctr, i);
    }
  }
  const cap = (i: number, band: number, sign: number) => {
    const c = center(i), r = rings[i];
    const inner = center(i === 0 ? 1 : i - 1);
    for (let j = 0; j < seg; j++) {
      const k = (j + 1) % seg;
      const A = pts[i][j].p, B = pts[i][k].p;
      const n = new THREE.Vector3().crossVectors(B.clone().sub(A), c.clone().sub(A));
      const out = c.clone().sub(inner);
      const flip = n.dot(out) * sign < 0;
      const tone = r.sh ?? 1;
      const center3: RP = { p: c, f: new THREE.Vector3() };
      for (const q of flip ? [pts[i][k], pts[i][j], center3] : [pts[i][j], pts[i][k], center3]) push(part, q, r.w, rings[band].role, tone);
    }
  };
  if (o.capStart) cap(0, 0, 1);
  if (o.capEnd) cap(rings.length - 1, rings.length - 2, 1);
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

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();

/** Peça rígida presa a um osso (dedos, nariz, acessórios). As coordenadas já são as do corpo em repouso. */
export function rigid(g: THREE.BufferGeometry, joint: Joint, role: Role, p: Place = {}): Part {
  const geo = g.index ? g.toNonIndexed() : g;
  E.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0);
  Q.setFromEuler(E);
  M.compose(P.set(p.x ?? 0, p.y ?? 0, p.z ?? 0), Q, S.set(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1));
  geo.applyMatrix4(M);
  const part = newPart(p.skin), a = geo.attributes.position, f = p.fat ?? [0, 0, 0], rnd = seeded(a.count + 3);
  let tone = 1;
  for (let i = 0; i < a.count; i++) {
    if (i % 3 === 0) tone = (p.sh ?? 1) * (1 + (rnd() - 0.5) * 0.07);
    part.pos.push(a.getX(i), a.getY(i), a.getZ(i));
    part.fat.push(f[0], f[1], f[2]);
    part.bones.push(idx(joint), idx(joint));
    part.wts.push(1, 0);
    part.roles.push(role);
    part.shade.push(tone);
  }
  geo.dispose();
  return part;
}

/** Junta as partes numa geometria com esqueleto e deformação de "engordar". */
export function assemble(parts: Part[], color: (role: Role, out: THREE.Color) => THREE.Color): { geo: THREE.BufferGeometry; roles: Role[]; shade: Float32Array } {
  const n = parts.reduce((a, p) => a + p.roles.length, 0);
  const pos = new Float32Array(n * 3), fat = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), shade = new Float32Array(n);
  const roles: Role[] = new Array(n);
  const c = new THREE.Color();
  let v = 0;
  for (const p of parts) {
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
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
  geo.computeVertexNormals();
  geo.morphAttributes.position = [new THREE.BufferAttribute(fat, 3)];
  geo.morphTargetsRelative = true;
  return { geo, roles, shade };
}
