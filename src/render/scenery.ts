import * as THREE from "three";
import { UNITS_PER_METER } from "../rules/constants";
import { seeded, type Prefab } from "./builder";
import { ROAD_W, VIEW_FAR } from "./config";
import { buildPrefabs } from "./props";

/**
 * Cenário que acompanha a corrida, em blocos de 20 unidades.
 * A cada 300 m o bairro muda: Bairro residencial → Feira livre → Parque → Orla, e repete.
 * Os blocos são gerados com semente: o mesmo trecho sempre tem o mesmo cenário.
 */

export type Biome = "bairro" | "feira" | "parque" | "orla";
export const BIOMES: readonly Biome[] = ["bairro", "feira", "parque", "orla"];
export const BIOME_NAMES: Record<Biome, string> = { bairro: "Bairro residencial", feira: "Feira livre", parque: "Parque", orla: "Orla" };
export const BIOME_METERS = 300;
export const biomeAt = (units: number): Biome => {
  const n = BIOMES.length;
  return BIOMES[((Math.floor(units / UNITS_PER_METER / BIOME_METERS) % n) + n) % n];
};

const CHUNK = 20;
const HALF = ROAD_W / 2;
const WALK_W = 2.5;
const VERGE_X = HALF + WALK_W;

interface Placed { id: string; x: number; z: number }

function walkTexture(biome: Biome): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d")!;
  if (biome === "orla") {
    // calçadão com ondas em preto e branco
    g.fillStyle = "#f2efe6";
    g.fillRect(0, 0, 128, 256);
    g.strokeStyle = "#2b2b2b";
    g.lineWidth = 14;
    for (let y = -64; y < 320; y += 64) {
      g.beginPath();
      for (let x = 0; x <= 128; x += 4) g.lineTo(x, y + Math.sin((x / 128) * Math.PI * 2) * 18);
      g.stroke();
    }
  } else if (biome === "parque") {
    g.fillStyle = "#d9cfbd";
    g.fillRect(0, 0, 128, 256);
    g.fillStyle = "#c0504d"; // ciclovia
    g.fillRect(0, 0, 62, 256);
    g.fillStyle = "#ffffff";
    for (let y = 0; y < 256; y += 64) g.fillRect(29, y, 4, 34);
  } else {
    g.fillStyle = biome === "feira" ? "#d6cbb6" : "#d9d2c4";
    g.fillRect(0, 0, 128, 256);
    g.strokeStyle = biome === "feira" ? "#bfb39c" : "#c4bcad";
    g.lineWidth = 3;
    for (let y = 0; y <= 256; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
    for (let x = 0; x <= 128; x += 43) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  }
  // meio-fio
  g.fillStyle = "#ecebe6";
  g.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 3);
  t.anisotropy = 4;
  return t;
}

function lampPoolTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,220,150,1)");
  r.addColorStop(1, "rgba(255,220,150,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** O que vai em cada bloco, de cada lado (coordenadas do lado direito). */
function layout(biome: Biome, side: -1 | 1, i: number): Placed[] {
  const r = seeded(i * 2 + (side > 0 ? 1 : 0));
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const out: Placed[] = [];
  const trees = ["ipeRosa", "ipeAmarelo", "ipeRoxo", "mangueira"];
  const lamp = () => out.push({ id: "poste", x: HALF + 0.35, z: 10 });
  switch (biome) {
    case "bairro":
      for (const z of [4, 14]) out.push({ id: r() < 0.3 ? `sobrado${Math.floor(r() * 4)}` : `casa${Math.floor(r() * 6)}`, x: VERGE_X + 0.3, z });
      out.push({ id: pick(trees), x: HALF + 1.7, z: r() < 0.5 ? 1 : 18 });
      if (r() < 0.25) out.push({ id: "lixeira", x: HALF + 2.1, z: 6.5 });
      if (r() < 0.15) out.push({ id: "ponto", x: HALF + 0.6, z: 18 });
      lamp();
      break;
    case "feira":
      for (const z of [3, 9.5, 16]) out.push({ id: `barraca${Math.floor(r() * 4)}`, x: HALF + 0.3, z });
      out.push({ id: "caixotes", x: VERGE_X + 0.4, z: 6.5 + r() * 6 });
      out.push({ id: `casa${Math.floor(r() * 6)}`, x: VERGE_X + 3, z: 12 });
      lamp();
      break;
    case "parque":
      out.push({ id: "cerca", x: VERGE_X + 0.2, z: 10 });
      for (let k = 0; k < 4; k++) out.push({ id: pick(trees), x: VERGE_X + 1.5 + r() * 10, z: r() * 20 });
      if (r() < 0.6) out.push({ id: "banco", x: HALF + 1.9, z: 5 });
      lamp();
      break;
    case "orla":
      out.push({ id: `coqueiro${Math.floor(r() * 2)}`, x: HALF + 1.8, z: 4 });
      out.push({ id: `coqueiro${Math.floor(r() * 2)}`, x: HALF + 1.8, z: 14 });
      if (side > 0) {
        for (let k = 0; k < 2; k++) out.push({ id: `guardaSol${Math.floor(r() * 3)}`, x: VERGE_X + 1.5 + r() * 5, z: r() * 20 });
        if (r() < 0.35) out.push({ id: "quiosque", x: VERGE_X + 0.3, z: 10 });
      } else {
        out.push({ id: `predio${Math.floor(r() * 4)}`, x: VERGE_X + 0.4, z: 10 });
      }
      lamp();
      break;
  }
  return out;
}

const VERGE: Record<Biome, [string, string]> = {
  bairro: ["vergeGrass", "vergeGrass"],
  feira: ["vergePlaza", "vergePlaza"],
  parque: ["vergePark", "vergePark"],
  orla: ["vergePlaza", "vergeSea"], // [esquerda, direita]
};

/**
 * Um tipo de objeto do cenário desenhado de uma vez para todas as cópias (InstancedMesh).
 * Cópias livres ficam com escala zero (não aparecem).
 */
class Instances {
  mesh: THREE.InstancedMesh;
  private free: number[] = [];
  private static ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  private static M = new THREE.Matrix4();
  private static Q = new THREE.Quaternion();
  private static Y = new THREE.Vector3(0, 1, 0);
  private static P = new THREE.Vector3();
  private static S = new THREE.Vector3(1, 1, 1);

  constructor(private geo: THREE.BufferGeometry, private mat: THREE.Material | THREE.Material[], private parent: THREE.Object3D, cap = 24) {
    this.mesh = this.create(cap);
  }
  private create(cap: number): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(this.geo, this.mat, cap);
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = cap - 1; i >= 0; i--) { m.setMatrixAt(i, Instances.ZERO); this.free.push(i); }
    this.parent.add(m);
    return m;
  }
  add(x: number, z: number, ry: number): number {
    if (!this.free.length) {
      // cresce: dobra a capacidade e copia o que já existe
      const old = this.mesh, cap = old.count;
      this.free = [];
      this.mesh = this.create(cap * 2);
      this.free = this.free.filter((i) => i >= cap);
      for (let i = 0; i < cap; i++) { old.getMatrixAt(i, Instances.M); this.mesh.setMatrixAt(i, Instances.M); }
      old.removeFromParent();
      old.dispose();
    }
    const slot = this.free.pop()!;
    Instances.Q.setFromAxisAngle(Instances.Y, ry);
    Instances.M.compose(Instances.P.set(x, 0, z), Instances.Q, Instances.S);
    this.mesh.setMatrixAt(slot, Instances.M);
    this.mesh.instanceMatrix.needsUpdate = true;
    return slot;
  }
  remove(slot: number): void {
    this.mesh.setMatrixAt(slot, Instances.ZERO);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.free.push(slot);
  }
}

export class Scenery {
  readonly group = new THREE.Group();
  private prefabs = buildPrefabs();
  private kinds = new Map<string, Instances>();
  private chunks = new Map<number, { kind: Instances; slot: number }[]>();
  private walkMats: Record<Biome, THREE.MeshLambertMaterial>;
  private walkGeo = new THREE.BoxGeometry(WALK_W, 0.14, CHUNK);
  private poolMat = new THREE.MeshBasicMaterial({ map: lampPoolTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  private poolGeo = new THREE.PlaneGeometry(4.5, 4.5).rotateX(-Math.PI / 2);

  constructor() {
    this.walkMats = Object.fromEntries(BIOMES.map((b) => [b, new THREE.MeshLambertMaterial({ map: walkTexture(b) })])) as Record<Biome, THREE.MeshLambertMaterial>;
  }

  private kind(id: string): Instances {
    let k = this.kinds.get(id);
    if (k) return k;
    if (id.startsWith("walk:")) k = new Instances(this.walkGeo, this.walkMats[id.slice(5) as Biome], this.group, 20);
    else if (id === "lampPool") k = new Instances(this.poolGeo, this.poolMat, this.group, 20);
    else {
      const p = this.prefabs.get(id) as Prefab;
      k = new Instances(p.geo, p.make().material, this.group);
    }
    this.kinds.set(id, k);
    return k;
  }

  private spawn(i: number): void {
    const a = i * CHUNK;
    const biome = biomeAt(a + CHUNK / 2);
    const list: { kind: Instances; slot: number }[] = [];
    const put = (id: string, x: number, z: number, ry: number) => {
      const kind = this.kind(id);
      list.push({ kind, slot: kind.add(x, -(a + z), ry) });
    };
    for (const side of [-1, 1] as const) {
      const ry = side < 0 ? Math.PI : 0;
      put(`walk:${biome}`, side * (HALF + WALK_W / 2), CHUNK / 2, ry);
      put(VERGE[biome][side < 0 ? 0 : 1], side * VERGE_X, CHUNK / 2, ry);
      for (const p of layout(biome, side, i)) {
        put(p.id, side * p.x, p.z, ry);
        if (p.id === "poste") put("lampPool", side * (HALF - 0.6), p.z, 0);
      }
    }
    this.chunks.set(i, list);
  }

  /** dist em unidades do jogo; night 0–1 acende as luzes da rua. */
  update(dist: number, night: number, ahead = VIEW_FAR): void {
    this.group.position.z = dist;
    const first = Math.floor((dist - 16) / CHUNK), last = Math.floor((dist + ahead) / CHUNK);
    for (const [i, list] of this.chunks) {
      if (i < first || i > last) {
        for (const { kind, slot } of list) kind.remove(slot);
        this.chunks.delete(i);
      }
    }
    for (let i = first; i <= last; i++) if (!this.chunks.has(i)) this.spawn(i);
    this.poolMat.opacity = 0.55 * night;
  }
}
