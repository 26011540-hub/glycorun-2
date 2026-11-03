import * as THREE from "three";
import { item } from "../content/items";
import type { SkinId } from "../content/texts";
import { BOSS_DUR } from "../rules/constants";
import { lightAt } from "../rules/environment";
import { TARGET_HIGH, TARGET_LOW } from "../rules/glucose";
import type { GameEvent, GameState, WorldObject } from "../rules/state";
import { COLORS, LANE_W, ROAD_W, VIEW_FAR } from "./config";

// Etapas 1–2: cena com formas simples e itens como "fichas" com emoji.
// Na etapa 3 os blocos e fichas viram modelos low-poly.

const TILE = 8; // comprimento de um ciclo das faixas pintadas na rua
const PROP_SPACING = 9;
const PROPS_PER_SIDE = Math.ceil(VIEW_FAR / PROP_SPACING) + 2;
const RAIN_DROPS = 500;

const RING: Record<string, string> = {
  good: "#2fa866", water: "#2f9ee0", ex: "#2f7fe0", med: "#8a5cd6", bad: "#e2483d",
  veg: "#2fa866", prot: "#f08a3c", carb: "#e8b21c", pw: "#e8b21c",
};
const SKIN_COLOR: Record<SkinId, number> = { corredor: 0x2f7fe0, fone: 0x7a5cf0, mochila: 0x18a37a, acs: 0x3d8fd1 };

// cores do céu (dia, entardecer, noite), como no original
const SKY = { day: new THREE.Color(0x8fd0f0), dusk: new THREE.Color(0xf0a070), night: new THREE.Color(0x141e3c) };
const FOG = { day: new THREE.Color(0xbfe4f2), dusk: new THREE.Color(0xf2b892), night: new THREE.Color(0x24345c) };
const RAIN_GREY = new THREE.Color(0x8a94a3);

function laneTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#5d6574";
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = "#f3eed9";
  const edge = (0.4 / ROAD_W) * 128;
  for (const lx of [-0.5, 0.5]) {
    const x = ((lx * LANE_W) / ROAD_W + 0.5) * 128;
    g.fillRect(x - 2.5, 0, 5, 120);
  }
  g.fillStyle = "#eeeeea";
  g.fillRect(0, 0, edge * 0.6, 256);
  g.fillRect(128 - edge * 0.6, 0, edge * 0.6, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Ficha do item: disco branco, anel com a cor do significado e o emoji. */
function chipTexture(emoji: string, ring: string, power: boolean): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffffee";
  g.strokeStyle = ring;
  g.lineWidth = power ? 16 : 11;
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.font = '64px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(emoji, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Pool simples: reaproveita malhas em vez de criar e destruir a cada objeto. */
class Pool {
  private free: THREE.Object3D[] = [];
  constructor(private make: () => THREE.Object3D, private parent: THREE.Object3D) {}
  get(): THREE.Object3D {
    const m = this.free.pop() ?? this.make();
    m.visible = true;
    if (!m.parent) this.parent.add(m);
    return m;
  }
  release(m: THREE.Object3D): void {
    m.visible = false;
    this.free.push(m);
  }
}

export class World3D {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.1, VIEW_FAR + 20);
  private roadTex = laneTexture();
  private hemi = new THREE.HemisphereLight(0xffffff, 0x6b8f5a, 1.6);
  private sun = new THREE.DirectionalLight(0xffffff, 1.6);
  private player = new THREE.Group();
  private torso = new THREE.Group();
  private bodyMat = new THREE.MeshLambertMaterial({ color: COLORS.player });
  private shadow: THREE.Mesh;
  private quizShield: THREE.Mesh;
  private insulinRing: THREE.Mesh;
  private props: THREE.Object3D[] = [];
  private pools: Record<string, Pool> = {};
  private live = new Map<number, { mesh: THREE.Object3D; pool: Pool; key: string }>();
  private bosses: Record<"lata" | "burger", THREE.Group>;
  private plateTint: THREE.Group;
  private rain: THREE.LineSegments;
  private rainPos: Float32Array;
  private camX = 0;
  private shake = 0;
  private squash = 0;
  private portrait = false;
  private skinColor = COLORS.player;
  private tmp = new THREE.Color();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const s = this.scene;
    s.background = SKY.day.clone();
    s.fog = new THREE.Fog(FOG.day.clone(), 55, VIEW_FAR);
    this.sun.position.set(-6, 12, 6);
    s.add(this.hemi, this.sun);

    // chão
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(200, VIEW_FAR + 40), new THREE.MeshLambertMaterial({ color: COLORS.grass }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, -0.02, -VIEW_FAR / 2 + 10);
    s.add(grass);
    const roadLen = VIEW_FAR + 20;
    this.roadTex.repeat.set(1, roadLen / TILE);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, roadLen), new THREE.MeshLambertMaterial({ map: this.roadTex }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -roadLen / 2 + 10);
    s.add(road);
    for (const side of [-1, 1]) {
      const walk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, roadLen), new THREE.MeshLambertMaterial({ color: COLORS.sidewalk }));
      walk.position.set(side * (ROAD_W / 2 + 1.1), 0.06, -roadLen / 2 + 10);
      s.add(walk);
    }

    // faixas coloridas do Desafio do Prato (vegetal, proteína, carboidrato)
    this.plateTint = new THREE.Group();
    [0x2fa866, 0xf08a3c, 0xe8b21c].forEach((c, i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W * 0.96, roadLen), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.3, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set((i - 1) * LANE_W, 0.012, -roadLen / 2 + 10);
      this.plateTint.add(m);
    });
    this.plateTint.visible = false;
    s.add(this.plateTint);

    this.buildProps();
    this.shadow = this.buildPlayer();
    this.quizShield = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 14), new THREE.MeshBasicMaterial({ color: 0x5ad1a8, transparent: true, opacity: 0.22, depthWrite: false }));
    this.quizShield.position.y = 0.95;
    this.insulinRing = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 6, 32), new THREE.MeshBasicMaterial({ color: 0xb48cff }));
    this.insulinRing.rotation.x = Math.PI / 2;
    this.insulinRing.position.y = 1.0;
    this.player.add(this.quizShield, this.insulinRing);
    this.bosses = { lata: this.buildBoss("lata"), burger: this.buildBoss("burger") };

    // chuva: segmentos de linha reposicionados a cada quadro (sem criar objetos)
    this.rainPos = new Float32Array(RAIN_DROPS * 6);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.BufferAttribute(this.rainPos, 3).setUsage(THREE.DynamicDrawUsage));
    for (let i = 0; i < RAIN_DROPS; i++) this.resetDrop(i, Math.random() * 12);
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xd2e1ff, transparent: true, opacity: 0 }));
    this.rain.frustumCulled = false;
    s.add(this.rain);

    this.buildPools();
  }

  private buildProps(): void {
    const houseGeo = new THREE.BoxGeometry(1, 1, 1);
    houseGeo.translate(0, 0.5, 0);
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.16, 1.2, 6);
    trunkGeo.translate(0, 0.6, 0);
    const crownGeo = new THREE.IcosahedronGeometry(0.9, 0);
    crownGeo.translate(0, 1.9, 0);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6e4a2e });
    const crownMat = new THREE.MeshLambertMaterial({ color: 0x3f9a49, flatShading: true });
    const pastel = [0xf2c6a0, 0xa8d5e2, 0xf7e3a1, 0xc4e3b5, 0xf3b8c4, 0xd9c7f0].map((c) => new THREE.MeshLambertMaterial({ color: c }));
    for (const side of [-1, 1]) {
      for (let i = 0; i < PROPS_PER_SIDE; i++) {
        let o: THREE.Object3D;
        if (i % 3 === 2) {
          o = new THREE.Group();
          o.add(new THREE.Mesh(trunkGeo, trunkMat), new THREE.Mesh(crownGeo, crownMat));
          o.position.x = side * (ROAD_W / 2 + 1.6);
        } else {
          const h = 2.6 + ((i * 37) % 7) * 0.35;
          o = new THREE.Mesh(houseGeo, pastel[(i + (side > 0 ? 3 : 0)) % pastel.length]);
          o.scale.set(3.2, h, 6.5);
          o.position.x = side * (ROAD_W / 2 + 4.2);
        }
        o.userData.base = i * PROP_SPACING + (side > 0 ? PROP_SPACING / 2 : 0);
        this.props.push(o);
        this.scene.add(o);
      }
    }
  }

  private buildPlayer(): THREE.Mesh {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.75, 4, 10), this.bodyMat);
    body.position.y = 0.7;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshLambertMaterial({ color: COLORS.skin }));
    head.position.y = 1.5;
    this.torso.add(body, head);
    this.player.add(this.torso);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    this.scene.add(this.player, shadow);
    return shadow;
  }

  private buildBoss(type: "lata" | "burger"): THREE.Group {
    const g = new THREE.Group();
    const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    if (type === "lata") {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3.4, 12), lam(0xe8463c));
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.15, 12), lam(0xc9ced6));
      lid.position.y = 1.75;
      g.add(can, lid);
    } else {
      const parts: [number, number, number, number][] = [[0xe3a24a, 1.0, 1.8, 0.9], [0x4cae4c, 0.2, 1.9, 0.35], [0x6b3a1e, 0.6, 1.8, -0.05], [0xffcf3f, 0.15, 1.85, -0.42], [0xe3a24a, 0.6, 1.7, -0.8]];
      for (const [c, h, r, y] of parts) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), lam(c));
        m.position.y = y;
        g.add(m);
      }
    }
    // rosto bravo
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff }), dark = new THREE.MeshBasicMaterial({ color: 0x14253d });
    const ey = type === "lata" ? 0.5 : 0.95;
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), white);
      eye.position.set(sx * 0.55, ey, 1.4);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), dark);
      pupil.position.set(sx * 0.5, ey - 0.02, 1.66);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.1), dark);
      brow.position.set(sx * 0.55, ey + 0.38, 1.6);
      brow.rotation.z = sx * -0.35;
      g.add(eye, pupil, brow);
    }
    g.visible = false;
    this.scene.add(g);
    return g;
  }

  private buildPools(): void {
    const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c });
    const sofaMat = lam(COLORS.sofa), darkMat = lam(0x8e342e);
    const telaMat = lam(COLORS.tela), frameMat = lam(0x1b2230), postMat = lam(0x3b4250);
    const pilhaMat = lam(COLORS.pilha), screenMats = [lam(0xff7a59), lam(0x5ad1a8), lam(0xffd166)];
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z = 0) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      return b;
    };
    this.pools.sofa = new Pool(() => {
      const g = new THREE.Group();
      g.add(box(1.8, 0.45, 1.0, sofaMat, 0, 0.3), box(1.8, 0.5, 0.25, darkMat, 0, 0.75, -0.38), box(0.25, 0.55, 1.0, darkMat, -0.85, 0.35), box(0.25, 0.55, 1.0, darkMat, 0.85, 0.35));
      return g;
    }, this.scene);
    this.pools.tela = new Pool(() => {
      const g = new THREE.Group();
      g.add(box(0.1, 2.35, 0.1, postMat, -0.95, 1.17), box(0.1, 2.35, 0.1, postMat, 0.95, 1.17), box(1.95, 1.0, 0.15, frameMat, 0, 1.75), box(1.75, 0.82, 0.05, telaMat, 0, 1.75, 0.08));
      return g;
    }, this.scene);
    this.pools.pilha = new Pool(() => {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) g.add(box(1.7, 0.78, 0.9, pilhaMat, 0, 0.4 + i * 0.8), box(1.45, 0.55, 0.05, screenMats[i], 0, 0.4 + i * 0.8, 0.46));
      return g;
    }, this.scene);
  }

  /** Pool de fichas de item, uma por aparência (id + se é correção de hipo). */
  private itemPool(key: string): Pool {
    let p = this.pools[key];
    if (!p) {
      const [id, fix] = key.split(":");
      const it = item(id);
      const mat = new THREE.SpriteMaterial({ map: chipTexture(it.e, fix ? RING.good : RING[it.k], it.k === "pw"), fog: true });
      const size = it.k === "pw" ? 1.3 : 1.05;
      p = this.pools[key] = new Pool(() => {
        const sp = new THREE.Sprite(mat);
        sp.scale.set(size, size, 1);
        return sp;
      }, this.scene);
    }
    return p;
  }

  setSkin(skin: SkinId): void {
    this.skinColor = SKIN_COLOR[skin] ?? COLORS.player;
    this.bodyMat.color.setHex(this.skinColor);
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.portrait = aspect < 0.85;
    this.camera.aspect = aspect;
    // Em pé, a câmera abre mais o ângulo e recua um pouco para caberem as três faixas.
    this.camera.fov = this.portrait ? 70 : 58;
    this.camera.updateProjectionMatrix();
  }

  private resetDrop(i: number, y = 10 + Math.random() * 3): void {
    const x = (Math.random() - 0.5) * 16, z = -Math.random() * 30 + 4;
    const p = this.rainPos;
    p.set([x, y, z, x + 0.12, y - 0.55, z], i * 6);
  }

  update(s: GameState, events: GameEvent[], dt: number, time: number): void {
    for (const e of events) {
      if (e.type === "hit" || e.type === "glucoseLife") this.shake = 0.45;
      if (e.type === "land") this.squash = 1;
    }
    this.updateSky(s, dt);

    // jogador: largura acompanha o condicionamento (decisão do autor)
    const hypo = s.g < TARGET_LOW, hyper = s.g > TARGET_HIGH;
    const tremor = hypo ? (Math.random() - 0.5) * 0.06 : 0;
    const x = s.px * LANE_W;
    this.player.position.set(x + tremor, s.y, 0);
    const fat = 1 - 0.55 * (s.cond / 100);
    const width = 0.8 + fat * 0.5;
    const sliding = s.slide > 0 && s.y < 0.05;
    const run = s.y > 0 ? 0 : Math.abs(Math.sin(time * (hyper ? 9 : 12)));
    this.squash = Math.max(0, this.squash - dt * 6);
    this.torso.scale.set(width * (sliding ? 1.15 : 1 + this.squash * 0.12), sliding ? 0.5 : 1 - this.squash * 0.18 + run * 0.04, width);
    this.torso.position.y = run * 0.08;
    this.torso.rotation.z = -(s.lane - s.px) * 0.45; // inclina para o lado da troca de faixa
    this.torso.rotation.x = sliding ? -0.5 : s.vy > 0 ? -0.15 : 0;
    this.bodyMat.color.setHex(hyper ? 0xe46a4f : this.skinColor); // camisa avermelhada na hiper, como no original
    this.player.visible = !(s.inv > 0 && Math.floor(time * 14) % 2 === 0);
    this.quizShield.visible = s.shield > 0;
    this.insulinRing.visible = s.insShield;
    this.insulinRing.rotation.z = time * 2;
    this.shadow.position.x = x;
    const sh = (1 / (1 + s.y * 0.5)) * width;
    this.shadow.scale.set(sh, sh, sh);

    // casas e árvores
    const loop = PROPS_PER_SIDE * PROP_SPACING;
    for (const p of this.props) p.position.z = -((((p.userData.base as number) - s.dist) % loop + loop) % loop - 8);
    this.roadTex.offset.y = (s.dist / TILE) % 1;
    this.plateTint.visible = !!s.plate;

    // objetos do jogo
    for (const entry of this.live.values()) entry.mesh.userData.seen = false;
    for (const o of s.objs) {
      if (o.done && o.kind === "item") continue;
      const key = o.kind === "obs" ? o.type : o.type + (hypo && item(o.type).fast ? ":fix" : "");
      let entry = this.live.get(o.id);
      if (entry && entry.key !== key) {
        entry.pool.release(entry.mesh);
        entry = undefined;
      }
      if (!entry) {
        const pool = o.kind === "obs" ? this.pools[o.type] : this.itemPool(key);
        entry = { mesh: pool.get(), pool, key };
        this.live.set(o.id, entry);
      }
      entry.mesh.userData.seen = true;
      this.place(entry.mesh, o, time);
    }
    for (const [id, entry] of this.live) {
      if (!entry.mesh.userData.seen) {
        entry.pool.release(entry.mesh);
        this.live.delete(id);
      }
    }

    // chefão
    for (const [type, g] of Object.entries(this.bosses)) {
      const B = s.boss;
      g.visible = !!B && B.type === type;
      if (!B || !g.visible) continue;
      const enter = Math.min(1, B.t / 1.2), leave = Math.min(1, Math.max(0, (BOSS_DUR - B.t) / 1.2));
      g.position.set(B.lx * LANE_W, 3.6 + Math.sin(B.t * 3) * 0.3, -(30 + (1 - Math.min(enter, leave)) * 80));
      g.rotation.y = Math.sin(B.t * 1.7) * 0.3;
    }

    // chuva
    const rm = this.rain.material as THREE.LineBasicMaterial;
    rm.opacity = 0.55 * s.rain;
    this.rain.visible = s.rain > 0.03;
    if (this.rain.visible && dt > 0) {
      const p = this.rainPos;
      for (let i = 0; i < RAIN_DROPS; i++) {
        const k = i * 6;
        const fall = 22 * dt;
        p[k + 1] -= fall; p[k + 4] -= fall;
        p[k] -= fall * 0.2; p[k + 3] -= fall * 0.2;
        if (p[k + 4] < 0) this.resetDrop(i);
      }
      this.rain.position.x = this.camX;
      (this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // câmera segue o jogador com atraso suave
    this.camX += (x * 0.7 - this.camX) * Math.min(1, dt * 6);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const sk = this.shake * this.shake;
    const back = this.portrait ? 7.6 : 6.4, up = this.portrait ? 5.0 : 3.8;
    this.camera.position.set(this.camX + (Math.random() - 0.5) * sk, up + s.y * 0.35 + (Math.random() - 0.5) * sk, back);
    this.camera.lookAt(this.camX * 0.9, 0.6 + s.y * 0.25, -14);

    this.renderer.render(this.scene, this.camera);
  }

  private updateSky(s: GameState, _dt: number): void {
    const L = lightAt(s.t);
    const bg = this.scene.background as THREE.Color;
    bg.copy(SKY.day).lerp(SKY.dusk, L.d * 0.8).lerp(SKY.night, L.n).lerp(RAIN_GREY, s.rain * 0.35 * (1 - L.n));
    const fog = (this.scene.fog as THREE.Fog).color;
    fog.copy(FOG.day).lerp(FOG.dusk, L.d * 0.8).lerp(FOG.night, L.n).lerp(RAIN_GREY, s.rain * 0.3 * (1 - L.n));
    this.hemi.intensity = 1.6 - L.n * 0.9 - s.rain * 0.3;
    this.sun.intensity = 1.6 * (1 - L.n * 0.85) - s.rain * 0.4;
    this.sun.color.copy(this.tmp.setHex(0xffffff).lerp(SKY.dusk, L.d * 0.6));
  }

  private place(m: THREE.Object3D, o: WorldObject, time: number): void {
    m.position.set(o.lx * LANE_W, 0, -o.z);
    if (o.kind === "item") {
      m.position.y = 0.95 + o.y0 + Math.sin(time * 4 + o.id) * 0.12;
      const pw = item(o.type).k === "pw";
      const base = pw ? 1.3 : 1.05;
      const k = pw ? base * (1 + Math.sin(time * 6) * 0.08) : base;
      m.scale.set(k, k, 1);
    }
  }
}
