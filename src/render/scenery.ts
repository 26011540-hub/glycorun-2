import * as THREE from "three";
import { UNITS_PER_METER } from "../rules/constants";
import { seeded, textTexture, type Prefab } from "./builder";
import { ROAD_W, VIEW_FAR } from "./config";
import { Arch } from "./landmarks";
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

/** center: posição absoluta (rua), sem espelhar para o lado esquerdo. ry: giro próprio. */
interface Placed { id: string; x: number; z: number; center?: boolean; ry?: number }

/** Detalhes que somem na qualidade baixa. */
const DECOR = /^(fios|varal|pipa|bandeirinhas|remendo|bueiro|sombra|caixotes|lixeira)/;
/** Objetos que ganham sombra suave no chão. */
const SHADOWED = /^(ipe|mangueira|araucaria|coqueiro|perua|carro|banca|pipoca|coco|orelhao)/;

function walkTexture(biome: Biome): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d")!;
  const r = seeded(BIOMES.indexOf(biome) + 5);
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
    // lajotas com tons levemente diferentes
    for (let y = 0; y < 256; y += 32) for (let x = 0; x < 128; x += 43) {
      g.fillStyle = `rgba(${r() < 0.5 ? "255,250,240" : "90,80,70"},${(0.03 + r() * 0.07).toFixed(3)})`;
      g.fillRect(x, y, 43, 32);
    }
    g.strokeStyle = biome === "feira" ? "#bfb39c" : "#c4bcad";
    g.lineWidth = 3;
    for (let y = 0; y <= 256; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
    for (let x = 0; x <= 128; x += 43) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  }
  // desgaste e meio-fio
  for (let k = 0; k < 500; k++) {
    g.fillStyle = r() < 0.5 ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.05)";
    g.fillRect(r() * 128, r() * 256, 2, 2);
  }
  g.fillStyle = "#ecebe6";
  g.fillRect(0, 0, 8, 256);
  g.fillStyle = "rgba(0,0,0,.14)";
  g.fillRect(8, 0, 3, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 3);
  t.anisotropy = 4;
  return t;
}

function radialTexture(color: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, `rgba(${color},1)`);
  r.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** O que vai em cada bloco, de cada lado (coordenadas do lado direito). */
function layout(biome: Biome | "campus", side: -1 | 1, i: number, clear = false): Placed[] {
  const r = seeded(i * 2 + (side > 0 ? 1 : 0));
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const out: Placed[] = [];
  const trees = ["ipeRosa", "ipeAmarelo", "ipeRoxo", "mangueira"];
  const lamp = () => {
    out.push({ id: "poste", x: HALF + 0.35, z: 10 }, { id: "fios", x: HALF + 0.35, z: 20 });
  };
  const street = () => {
    // detalhes do asfalto, uma vez por bloco
    if (side < 0) return;
    if (i % 5 === 2) out.push({ id: "faixa", x: 0, z: 6, center: true });
    if (r() < 0.55) out.push({ id: `remendo${Math.floor(r() * 2)}`, x: (r() - 0.5) * 5, z: r() * 20, center: true, ry: r() < 0.5 ? 0 : Math.PI / 2 });
    if (r() < 0.4) out.push({ id: "bueiro", x: (r() < 0.5 ? -1 : 1) * (HALF - 0.45), z: r() * 20, center: true });
  };
  switch (biome) {
    case "bairro": {
      const hasUbs = i % 23 === 7 && side > 0;
      if (hasUbs) out.push({ id: "ubs", x: VERGE_X + 0.3, z: 10 });
      else for (const z of [4, 14]) out.push({ id: r() < 0.3 ? `sobrado${Math.floor(r() * 4)}` : `casa${Math.floor(r() * 6)}`, x: VERGE_X + 0.3, z });
      out.push({ id: r() < 0.16 ? `araucaria${Math.floor(r() * 2)}` : pick(trees), x: HALF + 1.7, z: r() < 0.5 ? 1 : 18 });
      const extra = r();
      if (extra < 0.12) out.push({ id: "orelhao", x: HALF + 2.0, z: 6.5 });
      else if (extra < 0.22) out.push({ id: "banca", x: HALF + 0.55, z: 15 });
      else if (extra < 0.36) out.push({ id: `carro${Math.floor(r() * 4)}`, x: HALF + 1.35, z: 6 });
      else if (extra < 0.44) out.push({ id: `perua${Math.floor(r() * 3)}`, x: HALF + 1.35, z: 6 });
      else if (extra < 0.56) out.push({ id: "ponto", x: HALF + 0.6, z: 15 });
      else if (extra < 0.72) out.push({ id: "lixeira", x: HALF + 2.1, z: 6.5 });
      if (!hasUbs && r() < 0.3) out.push({ id: "varal", x: VERGE_X + 7, z: 9 });
      if (r() < 0.14) out.push({ id: `pipa${Math.floor(r() * 3)}`, x: VERGE_X + r() * 6, z: r() * 20 });
      lamp();
      break;
    }
    case "feira":
      for (const z of [3, 9.5, 16]) out.push({ id: `barraca${Math.floor(r() * 4)}`, x: HALF + 0.3, z });
      out.push({ id: "caixotes", x: VERGE_X + 0.4, z: 6.5 + r() * 6 });
      out.push({ id: `casa${Math.floor(r() * 6)}`, x: VERGE_X + 3, z: 12 });
      if (r() < 0.3) out.push({ id: r() < 0.5 ? "pipoca" : `carro${Math.floor(r() * 4)}`, x: VERGE_X + 1.3, z: 2 });
      if (side > 0 && i % 4 === 1) out.push({ id: "bandeirinhas", x: 0, z: 13, center: true });
      lamp();
      break;
    case "parque":
      out.push({ id: "cerca", x: VERGE_X + 0.2, z: 10 });
      for (let k = 0; k < 4; k++) out.push({ id: r() < 0.3 ? `araucaria${Math.floor(r() * 2)}` : pick(trees), x: VERGE_X + 1.5 + r() * 10, z: r() * 20 });
      if (r() < 0.6) out.push({ id: "banco", x: HALF + 1.9, z: 5 });
      if (r() < 0.22) out.push({ id: "pipoca", x: HALF + 1.5, z: 15 });
      if (r() < 0.2) out.push({ id: `pipa${Math.floor(r() * 3)}`, x: VERGE_X + 6, z: r() * 20 });
      lamp();
      break;
    case "campus":
      // gramados e araucárias em volta da entrada da universidade; perto do arco o terreno fica livre
      if (clear) {
        // só ao fundo, longe dos pilares e da guarita
        for (let k = 0; k < 3; k++) out.push({ id: `araucaria${Math.floor(r() * 2)}`, x: VERGE_X + 12 + r() * 12, z: r() * 20 });
        break;
      }
      for (let k = 0; k < 4; k++) out.push({ id: r() < 0.7 ? `araucaria${Math.floor(r() * 2)}` : "mangueira", x: VERGE_X + 1.5 + r() * 13, z: r() * 20 });
      if (r() < 0.4) out.push({ id: "banco", x: HALF + 1.9, z: 5 });
      lamp();
      break;
    case "orla":
      out.push({ id: `coqueiro${Math.floor(r() * 2)}`, x: HALF + 1.8, z: 4 });
      out.push({ id: `coqueiro${Math.floor(r() * 2)}`, x: HALF + 1.8, z: 14 });
      if (r() < 0.3) out.push({ id: "coco", x: HALF + 1.5, z: 9 });
      if (side > 0) {
        for (let k = 0; k < 2; k++) out.push({ id: `guardaSol${Math.floor(r() * 3)}`, x: VERGE_X + 1.5 + r() * 5, z: r() * 20 });
        if (r() < 0.35) out.push({ id: "quiosque", x: VERGE_X + 0.3, z: 10 });
      } else {
        out.push({ id: `predio${Math.floor(r() * 4)}`, x: VERGE_X + 0.4, z: 10 });
      }
      lamp();
      break;
  }
  street();
  return out;
}

const VERGE: Record<Biome | "campus", [string, string]> = {
  campus: ["vergePark", "vergePark"],
  bairro: ["vergeGrass", "vergeGrass"],
  feira: ["vergePlaza", "vergePlaza"],
  parque: ["vergePark", "vergePark"],
  orla: ["vergePlaza", "vergeSea"], // [esquerda, direita]
};

interface Handle { kind: Instances; slot: number }

/**
 * Um tipo de objeto do cenário desenhado de uma vez para todas as cópias (InstancedMesh).
 * Só as cópias em uso são desenhadas: ao remover uma, a última ocupa o lugar dela.
 */
class Instances {
  mesh: THREE.InstancedMesh;
  private owners: Handle[] = [];
  private static M = new THREE.Matrix4();
  private static Q = new THREE.Quaternion();
  private static Y = new THREE.Vector3(0, 1, 0);
  private static P = new THREE.Vector3();
  private static S = new THREE.Vector3(1, 1, 1);

  constructor(private geo: THREE.BufferGeometry, private mat: THREE.Material | THREE.Material[], private parent: THREE.Object3D, private cap = 32) {
    this.mesh = this.create();
  }
  private create(): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(this.geo, this.mat, this.cap);
    m.frustumCulled = false;
    m.count = 0;
    m.visible = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.parent.add(m);
    return m;
  }
  add(x: number, z: number, ry: number): Handle {
    const n = this.owners.length;
    if (n === this.cap) {
      // cresce: dobra a capacidade e copia o que já existe
      const old = this.mesh;
      this.cap *= 2;
      this.mesh = this.create();
      for (let i = 0; i < n; i++) { old.getMatrixAt(i, Instances.M); this.mesh.setMatrixAt(i, Instances.M); }
      old.removeFromParent();
      old.dispose();
    }
    Instances.Q.setFromAxisAngle(Instances.Y, ry);
    Instances.M.compose(Instances.P.set(x, 0, z), Instances.Q, Instances.S);
    this.mesh.setMatrixAt(n, Instances.M);
    const h: Handle = { kind: this, slot: n };
    this.owners.push(h);
    this.sync();
    return h;
  }
  remove(h: Handle): void {
    const last = this.owners.length - 1;
    if (h.slot !== last) {
      this.mesh.getMatrixAt(last, Instances.M);
      this.mesh.setMatrixAt(h.slot, Instances.M);
      this.owners[h.slot] = this.owners[last];
      this.owners[h.slot].slot = h.slot;
    }
    this.owners.pop();
    this.sync();
  }
  private sync(): void {
    this.mesh.count = this.owners.length;
    this.mesh.visible = this.owners.length > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Scenery {
  readonly group = new THREE.Group();
  /** Falso na qualidade baixa: pula os detalhes menores. */
  rich = true;
  /** Avisa quando o jogador passa sob o arco da UEPG. */
  onArch: (() => void) | null = null;
  private arch: Arch | null = null;
  private archAt: number | null = null; // posição do arco ao longo da rua
  private archPassed = false;
  private lastDist = 0;
  private prefabs = buildPrefabs();
  private kinds = new Map<string, Instances>();
  private chunks = new Map<number, Handle[]>();
  private walkMats: Record<Biome, THREE.MeshLambertMaterial>;
  private walkGeo = new THREE.BoxGeometry(WALK_W, 0.14, CHUNK);
  private poolMat = new THREE.MeshBasicMaterial({ map: radialTexture("255,220,150"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  private poolGeo = new THREE.PlaneGeometry(4.5, 4.5).rotateX(-Math.PI / 2);
  private shadowMat = new THREE.MeshBasicMaterial({ map: radialTexture("20,28,40"), transparent: true, depthWrite: false, opacity: 0.32 });
  private shadowGeo = new THREE.PlaneGeometry(3.4, 3.4).rotateX(-Math.PI / 2).translate(0, 0.09, 0);
  private signMat = new THREE.MeshBasicMaterial({ map: textTexture("UBS", { w: 256, h: 96, bg: "#ffffff", fg: "#1f5fa8", radius: 10 }) });
  private signGeo = new THREE.PlaneGeometry(2.4, 0.8).rotateY(-Math.PI / 2).translate(0.74, 2.72, 0);

  constructor() {
    this.walkMats = Object.fromEntries(BIOMES.map((b) => [b, new THREE.MeshLambertMaterial({ map: walkTexture(b) })])) as Record<Biome, THREE.MeshLambertMaterial>;
  }

  private kind(id: string): Instances {
    let k = this.kinds.get(id);
    if (k) return k;
    if (id.startsWith("walk:")) k = new Instances(this.walkGeo, this.walkMats[id.slice(5) as Biome], this.group);
    else if (id === "lampPool") k = new Instances(this.poolGeo, this.poolMat, this.group);
    else if (id === "sombra") k = new Instances(this.shadowGeo, this.shadowMat, this.group, 32);
    else if (id === "ubsPlaca") k = new Instances(this.signGeo, this.signMat, this.group, 4);
    else {
      const p = this.prefabs.get(id) as Prefab;
      k = new Instances(p.geo, p.make().material, this.group);
    }
    this.kinds.set(id, k);
    return k;
  }

  private spawn(i: number): void {
    const a = i * CHUNK;
    // perto do arco, o trecho vira campus: gramado e araucárias
    const at = this.archAt;
    const campus = at !== null && a + CHUNK > at - 70 && a < at + 50;
    const clear = at !== null && a + CHUNK > at - 20 && a < at + 18;
    const biome = campus ? "campus" : biomeAt(a + CHUNK / 2);
    const list: Handle[] = [];
    const put = (id: string, x: number, z: number, ry: number) => {
      if (!this.rich && DECOR.test(id)) return;
      list.push(this.kind(id).add(x, -(a + z), ry));
    };
    for (const side of [-1, 1] as const) {
      const ry = side < 0 ? Math.PI : 0;
      put(`walk:${biome === "campus" ? "bairro" : biome}`, side * (HALF + WALK_W / 2), CHUNK / 2, ry);
      put(VERGE[biome][side < 0 ? 0 : 1], side * VERGE_X, CHUNK / 2, ry);
      for (const p of layout(biome, side, i, clear)) {
        const x = p.center ? p.x : side * p.x;
        put(p.id, x, p.z, p.ry ?? (p.center ? 0 : ry));
        if (p.id === "poste") put("lampPool", side * (HALF - 0.6), p.z, 0);
        if (p.id === "ubs") put("ubsPlaca", x, p.z, ry);
        if (SHADOWED.test(p.id)) put("sombra", x, p.z, 0);
      }
    }
    if (at !== null && at - 8 >= a && at - 8 < a + CHUNK) put("faixa", 0, at - 8 - a, 0);
    this.chunks.set(i, list);
  }

  /** Cria uma cópia de tudo, longe da vista, para ser preparado; devolve como desfazer. */
  prewarm(): () => void {
    const hs: Handle[] = [];
    const ids = [...this.prefabs.keys(), ...BIOMES.map((b) => `walk:${b}`), "lampPool", "sombra", "ubsPlaca"];
    for (const id of ids) hs.push(this.kind(id).add(0, 500, 0));
    this.arch ??= new Arch();
    if (!this.arch.group.parent) this.group.add(this.arch.group);
    this.arch.group.visible = true;
    this.arch.group.position.z = -this.lastDist - 40;
    return () => {
      for (const h of hs) h.kind.remove(h);
      if (this.arch && this.archAt === null) this.arch.group.visible = false;
    };
  }

  /** Coloca o arco da UEPG na rua, além do que já está à vista. */
  placeArch(at: number): void {
    if (this.archAt !== null) return;
    this.arch ??= new Arch();
    if (!this.arch.group.parent) this.group.add(this.arch.group);
    this.arch.group.position.z = -at;
    this.arch.group.visible = true;
    this.archAt = at;
    this.archPassed = false;
  }

  private clearArch(): void {
    this.archAt = null;
    if (this.arch) this.arch.group.visible = false;
  }

  /** dist em unidades do jogo; night 0–1 acende as luzes da rua. */
  update(dist: number, night: number, ahead = VIEW_FAR): void {
    this.group.position.z = dist;
    if (dist < this.lastDist - 50) this.clearArch(); // nova corrida
    this.lastDist = dist;
    if (this.archAt !== null) {
      if (!this.archPassed && this.archAt - dist < 5) { this.archPassed = true; this.onArch?.(); }
      if (this.archAt < dist - 30) this.clearArch();
    }
    const first = Math.floor((dist - 16) / CHUNK), last = Math.floor((dist + ahead) / CHUNK);
    for (const [i, list] of this.chunks) {
      if (i < first || i > last) {
        for (const h of list) h.kind.remove(h);
        this.chunks.delete(i);
      }
    }
    for (let i = first; i <= last; i++) if (!this.chunks.has(i)) this.spawn(i);
    this.poolMat.opacity = 0.55 * night;
    this.shadowMat.opacity = 0.32 * (1 - night * 0.7);
  }
}
