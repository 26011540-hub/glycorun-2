import * as THREE from "three";
import { item } from "../content/items";
import type { SkinId } from "../content/texts";
import { BOSS_DUR } from "../rules/constants";
import { lightAt } from "../rules/environment";
import { TARGET_HIGH, TARGET_LOW } from "../rules/glucose";
import type { GameEvent, GameState, WorldObject } from "../rules/state";
import { MAT, type Prefab } from "./builder";
import { Character, type Motion } from "./character";
import { LANE_W, ROAD_W, VIEW_FAR } from "./config";
import { buildBoss, buildItemPrefabs, buildObstaclePrefabs, hintMaterial, KIND_COLOR, OBSTACLE_HINT } from "./items3d";
import { Scenery } from "./scenery";
import { Sky } from "./sky";

export type ViewMode = "menu" | "run" | "pause" | "quiz" | "over";

const TILE = 8; // comprimento de um ciclo das faixas pintadas na rua
const RAIN_DROPS = 500;

function roadTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#59616e";
  g.fillRect(0, 0, 256, 256);
  // textura leve de asfalto
  for (let i = 0; i < 900; i++) {
    g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.06)";
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.fillStyle = "#f3eed9";
  for (const lx of [-0.5, 0.5]) {
    const x = ((lx * LANE_W) / ROAD_W + 0.5) * 256;
    g.fillRect(x - 4, 0, 8, 118);
  }
  g.fillStyle = "#f6f3ea";
  const edge = (0.25 / ROAD_W) * 256;
  g.fillRect(edge, 0, 5, 256);
  g.fillRect(256 - edge - 5, 0, 5, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Pool simples: reaproveita objetos em vez de criar e destruir a cada item. */
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
  private camera = new THREE.PerspectiveCamera(60, 1, 0.1, VIEW_FAR + 25);
  private sky = new Sky(VIEW_FAR + 10);
  private scenery = new Scenery();
  private roadTex = roadTexture();
  private roadMat = new THREE.MeshLambertMaterial({ map: this.roadTex });
  private hemi = new THREE.HemisphereLight(0xffffff, 0x6b8f5a, 1.5);
  private sun = new THREE.DirectionalLight(0xfff4e0, 1.9);
  private hero = new Character();
  private player = new THREE.Group();
  private shadow: THREE.Mesh;
  private quizShield: THREE.Mesh;
  private insulinRing: THREE.Mesh;
  private itemPrefabs = buildItemPrefabs();
  private obstaclePrefabs = buildObstaclePrefabs();
  private pools = new Map<string, Pool>();
  private live = new Map<number, { obj: THREE.Object3D; pool: Pool; key: string }>();
  private haloGeo = new THREE.RingGeometry(0.5, 0.66, 24).rotateX(-Math.PI / 2);
  private haloMats = new Map<string, THREE.MeshBasicMaterial>();
  private powerRingGeo = new THREE.TorusGeometry(0.52, 0.035, 5, 28);
  private powerRingMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  private hintMats: Record<string, THREE.SpriteMaterial> = {};
  private bosses: Record<"lata" | "burger", THREE.Group>;
  private plateTint = new THREE.Group();
  private rain: THREE.LineSegments;
  private rainPos = new Float32Array(RAIN_DROPS * 6);
  private camX = 0;
  private shake = 0;
  private fat = 0.85;
  private turn = Math.PI; // de frente para a câmera no menu
  private portrait = false;
  private tmp = new THREE.Color();
  /** Câmera de perto (só desenvolvimento). */
  closeup: { x: number; y: number; z: number } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const s = this.scene;
    s.fog = new THREE.Fog(0xcdeefc, 60, VIEW_FAR);
    this.sun.position.set(-8, 14, 6);
    s.add(this.hemi, this.sun, this.sky.group, this.scenery.group);

    // rua: um plano só, com a textura correndo
    const roadLen = VIEW_FAR + 30;
    this.roadTex.repeat.set(1, roadLen / TILE);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, roadLen), this.roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -roadLen / 2 + 14);
    s.add(road);

    // faixas coloridas do Desafio do Prato (vegetal, proteína, carboidrato)
    [KIND_COLOR.veg, KIND_COLOR.prot, KIND_COLOR.carb].forEach((c, i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W * 0.94, roadLen), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.28, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set((i - 1) * LANE_W, 0.012, -roadLen / 2 + 14);
      this.plateTint.add(m);
    });
    this.plateTint.visible = false;
    s.add(this.plateTint);

    // jogador
    this.player.add(this.hero.root);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;
    this.quizShield = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 14), new THREE.MeshBasicMaterial({ color: 0x5ad1a8, transparent: true, opacity: 0.2, depthWrite: false }));
    this.quizShield.position.y = 0.95;
    this.insulinRing = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 6, 32), new THREE.MeshBasicMaterial({ color: 0xb48cff }));
    this.insulinRing.rotation.x = Math.PI / 2;
    this.insulinRing.position.y = 1.0;
    this.player.add(this.quizShield, this.insulinRing);
    s.add(this.player, this.shadow);

    this.bosses = { lata: buildBoss("lata"), burger: buildBoss("burger") };
    s.add(this.bosses.lata, this.bosses.burger);
    for (const [k, v] of Object.entries(OBSTACLE_HINT)) this.hintMats[k] = hintMaterial(v.text);

    // chuva: segmentos de linha reposicionados a cada quadro (sem criar objetos)
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.BufferAttribute(this.rainPos, 3).setUsage(THREE.DynamicDrawUsage));
    for (let i = 0; i < RAIN_DROPS; i++) this.resetDrop(i, Math.random() * 12);
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xd2e1ff, transparent: true, opacity: 0 }));
    this.rain.frustumCulled = false;
    s.add(this.rain);
  }

  private halo(key: string): THREE.MeshBasicMaterial {
    let m = this.haloMats.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: KIND_COLOR[key as keyof typeof KIND_COLOR], transparent: true, opacity: 0.85, depthWrite: false });
      this.haloMats.set(key, m);
    }
    return m;
  }

  private pool(key: string): Pool {
    let p = this.pools.get(key);
    if (p) return p;
    const [id, fix] = key.split(":");
    if (this.obstaclePrefabs.has(id)) {
      const prefab = this.obstaclePrefabs.get(id) as Prefab;
      p = new Pool(() => {
        const g = new THREE.Group();
        g.add(prefab.make());
        const hint = new THREE.Sprite(this.hintMats[id]);
        hint.scale.set(1.9, 0.48, 1);
        hint.position.y = OBSTACLE_HINT[id].y;
        hint.name = "hint";
        g.add(hint);
        return g;
      }, this.scene);
    } else {
      const it = item(id);
      const prefab = this.itemPrefabs.get(id) as Prefab;
      const haloMat = this.halo(fix ? "fix" : it.k);
      p = new Pool(() => {
        const g = new THREE.Group();
        const model = prefab.make();
        model.name = "model";
        model.scale.setScalar(1.7);
        const ring = new THREE.Mesh(this.haloGeo, haloMat);
        ring.position.y = 0.03;
        g.add(model, ring);
        if (it.k === "pw") {
          const pr = new THREE.Mesh(this.powerRingGeo, this.powerRingMat);
          pr.name = "power";
          pr.position.y = 0.95;
          g.add(pr);
        }
        return g;
      }, this.scene);
    }
    this.pools.set(key, p);
    return p;
  }

  setSkin(skin: SkinId): void {
    this.hero.setSkin(skin);
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.portrait = aspect < 0.85;
    this.camera.aspect = aspect;
    // Em pé, a câmera abre mais o ângulo e recua um pouco para caberem as três faixas.
    this.camera.fov = this.portrait ? 66 : 56;
    this.camera.updateProjectionMatrix();
  }

  private resetDrop(i: number, y = 10 + Math.random() * 3): void {
    const x = (Math.random() - 0.5) * 16, z = -Math.random() * 30 + 4;
    this.rainPos.set([x, y, z, x + 0.12, y - 0.55, z], i * 6);
  }

  update(s: GameState, events: GameEvent[], dt: number, time: number, mode: ViewMode): void {
    for (const e of events) {
      if (e.type === "hit" || e.type === "glucoseLife") { this.shake = 0.45; this.hero.hit(); }
      else if (e.type === "jump" && e.double) this.hero.flip();
      else if ((e.type === "bossEnd" || e.type === "plateEnd") && e.win) this.hero.cheer();
      else if (e.type === "quizEnd" && e.ok) this.hero.cheer();
    }
    const L = lightAt(s.t);
    const night = L.n;

    // jogador
    const hypo = s.g < TARGET_LOW, hyper = s.g > TARGET_HIGH;
    const x = s.px * LANE_W;
    this.player.position.set(x, s.y, 0);
    const playing = mode !== "menu";
    this.turn += ((playing ? 0 : Math.PI) - this.turn) * Math.min(1, dt * 5);
    this.player.rotation.y = this.turn;
    this.fat += (1 - s.cond / 100 - this.fat) * Math.min(1, dt * 1.5);
    this.hero.setFat(this.fat);
    let motion: Motion = "run";
    if (mode === "menu") motion = "idle";
    else if (mode === "over") motion = "tired";
    else if (s.slide > 0 && s.y < 0.3) motion = "slide";
    else if (s.y > 0.02) motion = s.vy > 0 ? "jump" : "fall";
    const animDt = mode === "pause" || mode === "quiz" ? 0 : Math.max(dt, mode === "menu" || mode === "over" ? 1 / 60 : 0);
    this.hero.update(animDt, { motion, speed: s.runSpeed, lean: playing ? s.lane - s.px : 0, hypo: playing && hypo, hyper: playing && hyper });
    this.player.visible = !(s.inv > 0 && mode === "run" && Math.floor(time * 14) % 2 === 0);
    this.quizShield.visible = s.shield > 0 && playing;
    this.insulinRing.visible = s.insShield && playing;
    this.insulinRing.rotation.z = time * 2;
    this.shadow.position.x = x;
    const sh = (1 / (1 + s.y * 0.5)) * (0.9 + this.fat * 0.35);
    this.shadow.scale.set(sh, sh, sh);

    // cenário, rua e prato
    this.scenery.update(s.dist, night);
    this.roadTex.offset.y = (s.dist / TILE) % 1;
    this.roadMat.color.setScalar(1 - s.rain * 0.28); // pista molhada fica mais escura
    this.plateTint.visible = !!s.plate && playing;
    MAT.glow.emissiveIntensity = Math.min(1, night * 1.1 + L.d * 0.25);

    // objetos do jogo
    for (const e of this.live.values()) e.obj.userData.seen = false;
    if (playing) {
      for (const o of s.objs) {
        if (o.done && o.kind === "item") continue;
        const key = o.kind === "obs" ? o.type : o.type + (hypo && item(o.type).fast ? ":fix" : "");
        let entry = this.live.get(o.id);
        if (entry && entry.key !== key) { entry.pool.release(entry.obj); entry = undefined; }
        if (!entry) {
          const pool = this.pool(key);
          entry = { obj: pool.get(), pool, key };
          this.live.set(o.id, entry);
        }
        entry.obj.userData.seen = true;
        this.place(entry.obj, o, s, time);
      }
    }
    for (const [id, e] of this.live) if (!e.obj.userData.seen) { e.pool.release(e.obj); this.live.delete(id); }

    // chefão
    for (const [type, g] of Object.entries(this.bosses)) {
      const B = s.boss;
      g.visible = playing && !!B && B.type === type;
      if (!B || !g.visible) continue;
      const enter = Math.min(1, B.t / 1.2), leave = Math.min(1, Math.max(0, (BOSS_DUR - B.t) / 1.2));
      g.position.set(B.lx * LANE_W, 3.6 + Math.sin(B.t * 3) * 0.3, -(30 + (1 - Math.min(enter, leave)) * 80));
      g.rotation.set(0, Math.sin(B.t * 1.7) * 0.3, Math.sin(B.t * 5) * 0.06);
    }

    // luz do dia e da noite
    this.hemi.intensity = 1.5 - night * 0.7 - s.rain * 0.3;
    this.hemi.groundColor.setHex(0x6b8f5a);
    this.sun.intensity = 1.9 * (1 - night * 0.9) - s.rain * 0.5;
    this.sun.color.copy(this.tmp.setHex(0xfff4e0).lerp(new THREE.Color(0xff9a5a), L.d * 0.7));

    // chuva
    const rm = this.rain.material as THREE.LineBasicMaterial;
    rm.opacity = 0.55 * s.rain;
    this.rain.visible = s.rain > 0.03 && playing;
    if (this.rain.visible && dt > 0) {
      const p = this.rainPos;
      const fall = 22 * dt;
      for (let i = 0; i < RAIN_DROPS; i++) {
        const k = i * 6;
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
    const back = this.portrait ? 7.6 : 6.4, up = this.portrait ? 5.6 : 4.0;
    this.camera.position.set(this.camX + (Math.random() - 0.5) * sk, up + s.y * 0.35 + (Math.random() - 0.5) * sk, back);
    this.camera.lookAt(this.camX * 0.9, (this.portrait ? 0 : 0.5) + s.y * 0.25, this.portrait ? -9 : -12);
    if (this.closeup) {
      // só para conferir o personagem de perto durante o desenvolvimento
      this.camera.position.set(x + this.closeup.x, s.y + this.closeup.y, this.closeup.z);
      this.camera.lookAt(x, s.y + 0.9, 0);
    }

    this.sky.update(L, s.rain, this.camera);
    (this.scene.fog as THREE.Fog).color.copy(this.sky.horizon);
    this.renderer.render(this.scene, this.camera);
  }

  private place(g: THREE.Object3D, o: WorldObject, s: GameState, time: number): void {
    g.position.set(o.lx * LANE_W, 0, -o.z);
    if (o.kind === "obs") {
      const hint = g.getObjectByName("hint") as THREE.Sprite;
      hint.material = this.hintMats[o.type === "pilha" && s.turbo > 0 ? "pilhaTurbo" : o.type];
      hint.visible = o.z > 3;
      return;
    }
    const model = g.getObjectByName("model")!;
    model.position.y = 0.35 + o.y0 + Math.sin(time * 4 + o.id) * 0.1;
    model.rotation.y = time * 2 + o.id;
    const pr = g.getObjectByName("power");
    if (pr) { pr.rotation.y = time * 3; pr.position.y = 0.85 + o.y0; }
  }

  /** Quantas chamadas de desenho o último quadro usou (para medir desempenho). */
  get drawCalls(): number { return this.renderer.info.render.calls; }
}
