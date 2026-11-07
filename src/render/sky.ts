import * as THREE from "three";
import type { Light } from "../rules/environment";
import { Builder, seeded } from "./builder";

/** Céu em degradê com sol, lua e estrelas. Acompanha a câmera e não recebe neblina. */

const C = (h: number) => new THREE.Color(h);
const TOP = { day: C(0x4fa8e6), dusk: C(0x4650a0), night: C(0x0a122e) };
const BOT = { day: C(0xcdeefc), dusk: C(0xfaaa6e), night: C(0x24345c) };
const RAIN = C(0x8a94a3);

const VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const FRAG = `uniform vec3 top; uniform vec3 bottom; varying vec3 vDir;
void main(){ float h = clamp(vDir.y * 2.2, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.75)), 1.0); }`;

function discTexture(soft: boolean): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (soft) { r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,248,220,1)"); r.addColorStop(0.45, "rgba(255,240,180,.45)"); r.addColorStop(1, "rgba(255,240,180,0)"); }
  else { r.addColorStop(0, "rgba(245,248,255,1)"); r.addColorStop(0.42, "rgba(240,244,255,1)"); r.addColorStop(0.5, "rgba(240,244,255,0)"); }
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class Sky {
  readonly group = new THREE.Group();
  readonly horizon = new THREE.Color();
  private uniforms = { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } };
  private sun: THREE.Sprite;
  private moon: THREE.Sprite;
  private stars: THREE.Points;
  private clouds: THREE.Mesh;
  private cloudMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false, depthWrite: false });
  private hillMat = new THREE.MeshBasicMaterial({ fog: false, depthWrite: false, side: THREE.DoubleSide });

  constructor(radius: number) {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 24, 12),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    dome.renderOrder = -10;
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTexture(true), fog: false, depthWrite: false, transparent: true }));
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTexture(false), fog: false, depthWrite: false, transparent: true }));
    for (const s of [this.sun, this.moon]) s.renderOrder = -9;
    const pts = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) {
      const a = Math.random() * Math.PI * 2, e = 0.12 + Math.random() * 1.2;
      pts.set([Math.cos(a) * Math.cos(e) * radius * 0.95, Math.sin(e) * radius * 0.95, Math.sin(a) * Math.cos(e) * radius * 0.95], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xfffff0, size: 1.6, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }));
    this.stars.renderOrder = -9;
    this.clouds = new THREE.Mesh(this.buildClouds(radius), this.cloudMat);
    this.clouds.renderOrder = -8;
    const hills = new THREE.Mesh(this.buildHills(radius), this.hillMat);
    hills.renderOrder = -8;
    this.group.add(dome, this.sun, this.moon, this.stars, hills, this.clouds);
    this.radius = radius;
  }
  private radius: number;

  /** Nuvens low-poly em volta do horizonte. */
  private buildClouds(radius: number): THREE.BufferGeometry {
    const b = new Builder(), r = seeded(9);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + r() * 0.3, d = radius * (0.62 + r() * 0.2), y = radius * (0.09 + r() * 0.1);
      const x = Math.cos(a) * d, z = Math.sin(a) * d, s = 3 + r() * 3.5;
      for (let k = 0; k < 5; k++) {
        b.ball(s * (0.65 + r() * 0.6), 0xffffff, { x: x + (k - 2) * s * 0.95 * -Math.sin(a), y: y + r() * s * 0.4, z: z + (k - 2) * s * 0.95 * Math.cos(a), sy: 0.6, flat: true }, 1);
      }
    }
    return b.build();
  }

  /** Colinas distantes dos Campos Gerais, em volta de todo o horizonte. */
  private buildHills(radius: number): THREE.BufferGeometry {
    const n = 72, R = radius * 0.92, pos: number[] = [];
    const h = (a: number) => 5 + 3.5 * Math.sin(a * 5 + 1) + 2.2 * Math.sin(a * 11 + 2) + 1.2 * Math.sin(a * 23);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, c = ((i + 1) / n) * Math.PI * 2;
      const ax = Math.cos(a) * R, az = Math.sin(a) * R, cx = Math.cos(c) * R, cz = Math.sin(c) * R;
      pos.push(ax, -6, az, cx, -6, cz, cx, h(c), cz, ax, -6, az, cx, h(c), cz, ax, h(a), az);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }

  update(L: Light, rain: number, camera: THREE.Camera): void {
    this.group.position.copy(camera.position);
    const u = this.uniforms;
    u.top.value.copy(TOP.day).lerp(TOP.dusk, L.d * 0.85).lerp(TOP.night, L.n).lerp(RAIN, rain * 0.4 * (1 - L.n));
    u.bottom.value.copy(BOT.day).lerp(BOT.dusk, L.d * 0.85).lerp(BOT.night, L.n).lerp(RAIN, rain * 0.45 * (1 - L.n));
    this.horizon.copy(u.bottom.value);
    this.hillMat.color.copy(u.bottom.value).lerp(u.top.value, 0.34);
    // brilho próprio neutro: sem isso, a luz verde refletida do chão tinge a parte de baixo das nuvens
    this.cloudMat.color.setScalar(0.55 * (1 - rain * 0.35));
    this.cloudMat.emissive.setScalar((0.5 - L.n * 0.42) * (1 - rain * 0.3));
    this.clouds.rotation.y += 0.00012; // vento leve

    // sol de dia (c < 0,66), lua à noite; atravessam o céu à frente do corredor
    const R = this.radius * 0.9;
    const sunT = Math.min(1, L.c / 0.66), moonT = Math.max(0, (L.c - 0.58) / 0.42);
    const place = (s: THREE.Sprite, t: number, size: number) => {
      const ang = Math.PI * (0.08 + 0.84 * t);
      s.position.set(Math.cos(ang) * R * 0.6, Math.sin(ang) * R * 0.45 + 6, -R * 0.75);
      s.scale.setScalar(size);
    };
    place(this.sun, sunT, 26);
    place(this.moon, moonT, 12);
    (this.sun.material as THREE.SpriteMaterial).opacity = (L.c < 0.66 ? 1 : 0) * (1 - rain * 0.7);
    (this.moon.material as THREE.SpriteMaterial).opacity = Math.min(1, L.n * 1.4) * (1 - rain * 0.6);
    this.sun.visible = L.c < 0.66;
    this.moon.visible = L.n > 0.02;
    (this.stars.material as THREE.PointsMaterial).opacity = L.n * (1 - rain);
    this.stars.visible = L.n > 0.05;
  }
}
