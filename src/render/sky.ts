import * as THREE from "three";
import type { Light } from "../rules/environment";

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
    this.group.add(dome, this.sun, this.moon, this.stars);
    this.radius = radius;
  }
  private radius: number;

  update(L: Light, rain: number, camera: THREE.Camera): void {
    this.group.position.copy(camera.position);
    const u = this.uniforms;
    u.top.value.copy(TOP.day).lerp(TOP.dusk, L.d * 0.85).lerp(TOP.night, L.n).lerp(RAIN, rain * 0.4 * (1 - L.n));
    u.bottom.value.copy(BOT.day).lerp(BOT.dusk, L.d * 0.85).lerp(BOT.night, L.n).lerp(RAIN, rain * 0.45 * (1 - L.n));
    this.horizon.copy(u.bottom.value);

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
