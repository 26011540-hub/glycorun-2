import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Builder, seeded } from "./builder";
import { ROAD_W } from "./config";

/**
 * Cachorros do bairro: só cenário, sempre na calçada, sem colisão e sem efeito nas regras.
 * Cada combinação raça + pose é desenhada de uma vez (InstancedMesh). Pernas e rabo são animados
 * na placa de vídeo: cada vértice sabe se é perna ou rabo, e a posição oscila no próprio desenho.
 */

export type Breed = "caramelo" | "labrador" | "salsicha" | "poodle" | "pastor" | "pinscher" | "fila";
type Pose = "stand" | "sit";

interface Spec {
  len: number; leg: number; w: number; // comprimento, altura da perna, largura do corpo
  coat: number; belly: number; muzzle: number;
  head: number; ear: "pe" | "caida"; tail: "alto" | "longo" | "pompom" | "curto";
  fluffy?: boolean; mask?: number; saddle?: number; // poodle fofo; máscara; manta nas costas
}

const SPECS: Record<Breed, Spec> = {
  caramelo: { len: 0.72, leg: 0.32, w: 0.15, coat: 0xc98a3f, belly: 0xe4bd80, muzzle: 0xe9cc97, head: 0.13, ear: "caida", tail: "alto" },
  labrador: { len: 0.84, leg: 0.36, w: 0.19, coat: 0xe6c88e, belly: 0xefdab0, muzzle: 0xf0dfbb, head: 0.15, ear: "caida", tail: "longo" },
  salsicha: { len: 0.82, leg: 0.12, w: 0.1, coat: 0x7a3f22, belly: 0xa9653a, muzzle: 0x8c4c2a, head: 0.095, ear: "caida", tail: "longo" },
  poodle: { len: 0.5, leg: 0.3, w: 0.12, coat: 0xf3efe8, belly: 0xf8f5ef, muzzle: 0xf3efe8, head: 0.105, ear: "caida", tail: "pompom", fluffy: true },
  pastor: { len: 0.92, leg: 0.4, w: 0.18, coat: 0xb07a3c, belly: 0xc89a5c, muzzle: 0x2a221c, head: 0.14, ear: "pe", tail: "longo", saddle: 0x2a221c },
  pinscher: { len: 0.42, leg: 0.2, w: 0.08, coat: 0x241c1a, belly: 0xa8622e, muzzle: 0xa8622e, head: 0.08, ear: "pe", tail: "curto" },
  fila: { len: 1.0, leg: 0.46, w: 0.24, coat: 0xa97c4b, belly: 0xbc9463, muzzle: 0x2f2620, head: 0.19, ear: "caida", tail: "longo", mask: 0x2f2620 },
};
const BREEDS = Object.keys(SPECS) as Breed[];
const NOSE = 0x171310;

/** Marca cada vértice: x = perna (sentido e amplitude), y = rabo (amplitude). */
function tagged(b: Builder, f: (y: number, z: number) => [number, number]): THREE.BufferGeometry {
  const g = b.build();
  const pos = g.attributes.position, a = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const [x, y] = f(pos.getY(i), pos.getZ(i));
    a[i * 2] = x; a[i * 2 + 1] = y;
  }
  g.setAttribute("aAnim", new THREE.BufferAttribute(a, 2));
  return g;
}

function dog(s: Spec, pose: Pose): THREE.BufferGeometry {
  const sit = pose === "sit";
  const L = s.len / 2, r = s.w, hip = s.leg + r * 0.7;
  const body = new Builder();
  const tilt = sit ? 0.85 : 0; // sentado: frente do corpo para cima
  const by = sit ? s.leg * 0.55 + r + L * 0.34 : hip + r * 0.15; // altura do centro do corpo
  const fuzz = s.fluffy ? 1.25 : 1;
  const frontY = by + Math.sin(tilt) * L * 0.8, frontZ = -Math.cos(tilt) * L * 0.8;
  const backY = by - Math.sin(tilt) * L * 0.75, backZ = Math.cos(tilt) * L * 0.75;

  // corpo: peito, barriga e anca
  body.ball(r * 1.08 * fuzz, s.coat, { y: frontY, z: frontZ, sz: 1.05, flat: true }, 1);
  body.ball(r * 0.98 * fuzz, s.coat, { y: by, sz: (L * 0.95) / r, rx: tilt, flat: true }, 1);
  body.ball(r * 1.02 * fuzz, s.coat, { y: backY, z: backZ, flat: true }, 1);
  body.ball(r * 0.8, s.belly, { y: by - r * 0.32, sz: (L * 0.72) / r, sy: 0.72, rx: tilt, flat: true }, 1);
  if (s.saddle) body.ball(r * 0.86, s.saddle, { y: by + r * 0.42, z: 0.02, sz: (L * 0.82) / r, sy: 0.55, rx: tilt, flat: true }, 1);

  // pescoço e cabeça, olhando para a frente
  const hr = s.head;
  const hy = frontY + r * 0.95 + hr * 0.5, hz = frontZ - r * 0.62;
  body.cyl(hr * 0.62, r * 0.72, r * 1.1, 7, s.coat, { y: frontY + r * 0.5, z: frontZ - r * 0.3, rx: 0.45, flat: true });
  body.ball(hr * fuzz, s.coat, { y: hy, z: hz, sy: 0.95, flat: true }, 1);
  const mz = hz - hr * 1.02, my = hy - hr * 0.2, mw = hr * 0.52;
  body.cyl(mw * 0.82, mw, hr * 0.95, 7, s.muzzle, { y: my, z: mz, rx: Math.PI / 2 + 0.1, flat: true });
  body.ball(mw * 0.42, NOSE, { y: my + mw * 0.32, z: mz - hr * 0.5, flat: true }, 0);
  if (s.mask) body.ball(hr * 0.72, s.mask, { y: hy - hr * 0.08, z: hz - hr * 0.5, sy: 0.75, flat: true }, 1);
  for (const sx of [-1, 1]) {
    body.ball(hr * 0.13, NOSE, { x: sx * hr * 0.46, y: hy + hr * 0.2, z: hz - hr * 0.84, flat: true }, 0);
    if (s.ear === "pe") body.cone(hr * 0.34, hr * 0.8, 4, s.saddle ?? s.coat, { x: sx * hr * 0.58, y: hy + hr * 1.05, z: hz + hr * 0.1, rz: -sx * 0.18, sz: 0.5, flat: true });
    else body.ball(hr * 0.42 * fuzz, s.fluffy ? s.coat : s.saddle ?? tone(s.coat, 0.72), { x: sx * hr * 0.98, y: hy - hr * 0.12, z: hz + hr * 0.1, sx: 0.42, sy: 1.25, flat: true }, 1);
  }
  if (s.fluffy) body.ball(hr * 0.72, s.coat, { y: hy + hr * 0.82, z: hz + hr * 0.08, flat: true }, 1); // topete do poodle

  const geos: THREE.BufferGeometry[] = [tagged(body, () => [0, 0])];

  // pernas: pares diagonais andam em oposição
  const legW = r * 0.27 * (s.fluffy ? 0.75 : 1);
  const legsAt = (sign: number, list: [number, number][]) => {
    const b = new Builder();
    for (const [sx, z] of list) {
      if (sit && z > 0) {
        // perna de trás dobrada: coxa e pata no chão
        b.ball(r * 0.62 * fuzz, s.coat, { x: sx * r * 0.72, y: r * 0.72 + s.leg * 0.12, z: backZ - r * 0.1, sy: 1.15, flat: true }, 1);
        b.ball(legW * 1.25, s.belly, { x: sx * r * 0.72, y: legW, z: backZ - r * 1.02, sz: 1.7, sy: 0.75, flat: true }, 0);
        continue;
      }
      const fz = sit ? frontZ + 0.02 : z, top = sit ? frontY : hip;
      b.cyl(legW * 1.15, legW * 0.8, top, 6, s.coat, { x: sx * r * 0.62, y: top / 2, z: fz, flat: true });
      b.ball(legW * 1.15, s.fluffy ? s.coat : s.belly, { x: sx * r * 0.62, y: legW * 0.7, z: fz - legW * 0.35, sz: 1.5, sy: 0.72, flat: true }, 0);
      if (s.fluffy) b.ball(legW * 2, s.coat, { x: sx * r * 0.62, y: legW * 1.5, z: fz, flat: true }, 1);
    }
    return tagged(b, (y) => [sit ? 0 : (sign * 0.42 * Math.max(0, hip - y)), 0]);
  };
  const fz = -L * 0.72, bz = L * 0.72;
  geos.push(legsAt(1, [[-1, fz], [1, bz]]), legsAt(-1, [[1, fz], [-1, bz]]));

  // rabo
  const t = new Builder();
  const tz = backZ + r * 0.85, ty = (sit ? r * 0.5 : backY + r * 0.35);
  const len = s.tail === "curto" ? s.len * 0.14 : s.tail === "pompom" ? s.len * 0.42 : s.len * 0.5;
  const ang = sit ? 1.35 : s.tail === "longo" ? 1.0 : s.tail === "alto" ? 0.42 : 0.5; // ângulo a partir da vertical
  const midY = ty + Math.cos(ang) * len * 0.5, midZ = tz + Math.sin(ang) * len * 0.5;
  t.cyl(r * 0.1, r * 0.2, len, 5, s.coat, { y: midY, z: midZ, rx: ang, flat: true });
  if (s.tail === "pompom") t.ball(r * 0.68, s.coat, { y: ty + Math.cos(ang) * len, z: tz + Math.sin(ang) * len, flat: true }, 1);
  if (s.tail === "alto") t.cyl(r * 0.05, r * 0.1, len * 0.42, 5, s.belly, { y: ty + Math.cos(ang) * len * 1.06, z: tz + Math.sin(ang) * len * 0.85 - len * 0.09, rx: -0.5, flat: true });
  geos.push(tagged(t, (y, z) => [0, Math.min(1, Math.hypot(y - ty, z - tz) / Math.max(len, 0.01)) * 0.7]));

  const merged = mergeGeometries(geos)!;
  for (const g of geos) g.dispose();
  return merged;
}

const _c = new THREE.Color();
const tone = (hex: number, f: number) => _c.setHex(hex).multiplyScalar(f).getHex();

interface Dog { key: string; x: number; z: number; ry: number; walk: boolean; wag: number; phase: number; z0: number; barked: boolean }
interface Kind { mesh: THREE.InstancedMesh; anim: THREE.InstancedBufferAttribute; count: number }

const CHUNK = 20, HALF = ROAD_W / 2, CAP = 6;
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), S = new THREE.Vector3(1.2, 1.2, 1.2);

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

  constructor() {
    const time = this.time;
    this.mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time;
      sh.vertexShader = "attribute vec2 aAnim;\nattribute vec3 aInst;\nuniform float uTime;\n" + sh.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float ph = uTime + aInst.x;
        transformed.z += aAnim.x * sin(ph * 9.0) * aInst.y;
        transformed.x += aAnim.y * sin(ph * 15.0) * 0.16 * aInst.z;`,
      );
    };
  }

  private kind(key: string): Kind {
    let k = this.kinds.get(key);
    if (k) return k;
    const [breed, pose] = key.split(":") as [Breed, Pose];
    const geo = dog(SPECS[breed], pose);
    const anim = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aInst", anim);
    const mesh = new THREE.InstancedMesh(geo, this.mat, CAP);
    mesh.frustumCulled = false;
    mesh.count = 0;
    this.group.add(mesh);
    k = { mesh, anim, count: 0 };
    this.kinds.set(key, k);
    return k;
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
      wag: walk ? 0.5 : 1, phase: r() * 10, barked: false,
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
    for (const list of this.chunks.values()) {
      for (const d of list) {
        const k = this.kind(d.key);
        if (k.count >= CAP) continue;
        let z = d.z, ry = d.ry;
        if (d.walk) {
          // passeia para a frente e para trás num trecho curto da calçada
          const t = this.time.value * 0.55 + d.phase, tri = Math.abs(((t / 2) % 2 + 2) % 2 - 1) * 2 - 1;
          z = d.z0 + tri * 0.9;
          ry = ((t / 2) % 2 + 2) % 2 < 1 ? 0 : Math.PI;
        }
        Q.setFromAxisAngle(Y, ry);
        M.compose(P.set(d.x, 0.07, -z), Q, S);
        k.mesh.setMatrixAt(k.count, M);
        k.anim.setXYZ(k.count, d.phase, d.walk ? 1 : 0, d.wag);
        k.count++;
        const near = z - dist;
        if (running && !d.barked && near > 2 && near < 11) {
          d.barked = true;
          if (this.barkWait <= 0 && Math.abs(d.phase % 1) < 0.4) { this.barkWait = 5; this.onBark?.(); }
        }
      }
    }
    for (const k of this.kinds.values()) {
      k.mesh.count = k.count;
      k.mesh.visible = k.count > 0;
      k.mesh.instanceMatrix.needsUpdate = true;
      k.anim.needsUpdate = true;
    }
  }
}
