import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * Monta modelos low-poly a partir de formas simples (caixas, cilindros, esferas) e junta tudo
 * numa única geometria com cores por vértice. Resultado: 1 objeto = 1 chamada de desenho (rápido no celular).
 * Partes marcadas com `glow` (janelas, lâmpadas, telas) acendem à noite.
 */
export interface Place {
  x?: number; y?: number; z?: number;
  rx?: number; ry?: number; rz?: number;
  sx?: number; sy?: number; sz?: number; s?: number;
  glow?: boolean;
}

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color();

export class Builder {
  private base: THREE.BufferGeometry[] = [];
  private glow: THREE.BufferGeometry[] = [];

  add(g: THREE.BufferGeometry, color: number, p: Place = {}): this {
    const geo = g.index ? g.toNonIndexed() : g;
    if (geo !== g) g.dispose();
    geo.deleteAttribute("uv");
    E.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0);
    Q.setFromEuler(E);
    const s = p.s ?? 1;
    S.set((p.sx ?? 1) * s, (p.sy ?? 1) * s, (p.sz ?? 1) * s);
    M.compose(P.set(p.x ?? 0, p.y ?? 0, p.z ?? 0), Q, S);
    geo.applyMatrix4(M);
    C.setHex(color);
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = C.r; col[i * 3 + 1] = C.g; col[i * 3 + 2] = C.b; }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    (p.glow ? this.glow : this.base).push(geo);
    return this;
  }
  box(w: number, h: number, d: number, c: number, p?: Place) { return this.add(new THREE.BoxGeometry(w, h, d), c, p); }
  cyl(rt: number, rb: number, h: number, seg: number, c: number, p?: Place) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), c, p); }
  cone(r: number, h: number, seg: number, c: number, p?: Place) { return this.add(new THREE.ConeGeometry(r, h, seg), c, p); }
  ball(r: number, c: number, p?: Place, detail = 1) { return this.add(new THREE.IcosahedronGeometry(r, detail), c, p); }
  sphere(r: number, ws: number, hs: number, c: number, p?: Place) { return this.add(new THREE.SphereGeometry(r, ws, hs), c, p); }
  torus(R: number, r: number, rs: number, ts: number, c: number, p?: Place, arc = Math.PI * 2) {
    return this.add(new THREE.TorusGeometry(R, r, rs, ts, arc), c, p);
  }
  /** Prisma triangular deitado ao longo de z (telhado de duas águas). */
  roof(w: number, h: number, len: number, c: number, p: Place = {}) {
    const g = new THREE.CylinderGeometry(1, 1, len, 3);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.5, 0); // base no y = 0
    return this.add(g, c, { ...p, sx: w / Math.sqrt(3), sy: h / 1.5 });
  }

  get hasGlow(): boolean { return this.glow.length > 0; }

  build(): THREE.BufferGeometry {
    const base = mergeGeometries(this.base)!;
    if (!this.glow.length) return base;
    const merged = mergeGeometries([base, mergeGeometries(this.glow)!], true)!;
    return merged;
  }
}

/** Materiais compartilhados por todos os modelos. */
export const MAT = {
  base: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  // acende à noite: World3D ajusta emissiveIntensity
  glow: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0xffc46b, emissiveIntensity: 0 }),
};

export function meshOf(b: Builder): THREE.Mesh {
  const glow = b.hasGlow;
  return new THREE.Mesh(b.build(), glow ? [MAT.base, MAT.glow] : MAT.base);
}

/** Geometria pronta + se usa o material de brilho; cria malhas que compartilham a geometria. */
export class Prefab {
  constructor(readonly geo: THREE.BufferGeometry, readonly glow: boolean) {}
  static of(b: Builder): Prefab { return new Prefab(b.build(), b.hasGlow); }
  make(): THREE.Mesh {
    const m = new THREE.Mesh(this.geo, this.glow ? [MAT.base, MAT.glow] : MAT.base);
    m.matrixAutoUpdate = true;
    return m;
  }
}

/** Textura de texto (placas, letreiros). */
export function textTexture(text: string, opts: { w?: number; h?: number; bg?: string; fg?: string; font?: string; radius?: number } = {}): THREE.CanvasTexture {
  const w = opts.w ?? 256, h = opts.h ?? 64;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  if (opts.bg) {
    g.fillStyle = opts.bg;
    const r = opts.radius ?? h / 3;
    g.beginPath();
    g.roundRect(2, 2, w - 4, h - 4, r);
    g.fill();
  }
  g.fillStyle = opts.fg ?? "#fff";
  let size = Math.round(h * 0.55);
  g.font = opts.font ?? `800 ${size}px system-ui, "Segoe UI", sans-serif`;
  // diminui a letra até o texto caber na placa
  while (!opts.font && size > 8 && g.measureText(text).width > w * 0.9) {
    size -= 2;
    g.font = `800 ${size}px system-ui, "Segoe UI", sans-serif`;
  }
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2 + h * 0.03);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Gerador pseudoaleatório simples para cenários repetíveis. */
export function seeded(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
