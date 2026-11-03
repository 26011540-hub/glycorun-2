import * as THREE from "three";

/**
 * Partículas leves: todas num único objeto (1 chamada de desenho), com posições recicladas.
 * Usadas para: brilho ao pegar itens, faíscas na batida, rastro verde nos pés, suor, confete, poeira.
 */

const MAX = 600;

const VERT = `
attribute float size; attribute vec4 tint;
varying vec4 vTint;
uniform float scale;
void main(){
  vTint = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
varying vec4 vTint;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  gl_FragColor = vec4(vTint.rgb, vTint.a * smoothstep(0.5, 0.15, d));
}`;

interface P { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; grav: number; r: number; g: number; b: number }

export class Particles {
  readonly points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private size = new Float32Array(MAX);
  private tint = new Float32Array(MAX * 4);
  private list: P[] = [];
  private free: P[] = [];
  private c = new THREE.Color();
  private uniforms = { scale: { value: 300 } };

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("size", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("tint", new THREE.BufferAttribute(this.tint, 4).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  /** Pontos têm tamanho em pixels: converte metros para pixels pela altura da imagem (em pixels reais) e o ângulo da câmera. */
  setViewport(bufferHeightPx: number, fovDeg: number): void { this.uniforms.scale.value = bufferHeightPx / (2 * Math.tan((fovDeg * Math.PI) / 360)); }

  emit(x: number, y: number, z: number, color: number, n: number, o: { speed?: number; up?: number; size?: number; life?: number; grav?: number; vz?: number; spread?: number } = {}): void {
    this.c.setHex(color);
    for (let i = 0; i < n; i++) {
      if (this.list.length >= MAX) return;
      const p = this.free.pop() ?? ({} as P);
      const sp = o.speed ?? 3, a = Math.random() * Math.PI * 2, s = o.spread ?? 1;
      p.x = x + (Math.random() - 0.5) * 0.2 * s;
      p.y = y + (Math.random() - 0.5) * 0.2 * s;
      p.z = z + (Math.random() - 0.5) * 0.2 * s;
      p.vx = Math.cos(a) * sp * Math.random();
      p.vz = Math.sin(a) * sp * Math.random() + (o.vz ?? 0);
      p.vy = (o.up ?? 2) * (0.5 + Math.random());
      p.max = p.life = (o.life ?? 0.6) * (0.7 + Math.random() * 0.6);
      p.size = (o.size ?? 0.12) * (0.7 + Math.random() * 0.6);
      p.grav = o.grav ?? 6;
      p.r = this.c.r; p.g = this.c.g; p.b = this.c.b;
      this.list.push(p);
    }
  }

  update(dt: number): void {
    let w = 0;
    for (const p of this.list) {
      p.life -= dt;
      if (p.life <= 0) { this.free.push(p); continue; }
      p.vy -= p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02) { p.y = 0.02; p.vy *= -0.3; }
      const k = w;
      this.pos[k * 3] = p.x; this.pos[k * 3 + 1] = p.y; this.pos[k * 3 + 2] = p.z;
      const t = p.life / p.max;
      this.size[k] = p.size * (0.4 + 0.6 * t);
      this.tint[k * 4] = p.r; this.tint[k * 4 + 1] = p.g; this.tint[k * 4 + 2] = p.b; this.tint[k * 4 + 3] = Math.min(1, t * 1.6);
      this.list[w++] = p;
    }
    this.list.length = w;
    const g = this.points.geometry;
    g.setDrawRange(0, w);
    for (const name of ["position", "size", "tint"]) {
      const at = g.attributes[name] as THREE.BufferAttribute;
      at.needsUpdate = true;
      at.clearUpdateRanges();
      at.addUpdateRange(0, w * at.itemSize);
    }
  }

  clear(): void {
    this.free.push(...this.list);
    this.list.length = 0;
  }
}
