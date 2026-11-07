import * as THREE from "three";
import { item } from "../content/items";
import type { SkinId } from "../content/texts";
import { BOSS_DUR, UNITS_PER_METER } from "../rules/constants";
import { lightAt } from "../rules/environment";
import { TARGET_HIGH, TARGET_LOW, zoneOf } from "../rules/glucose";
import type { GameEvent, GameState, WorldObject } from "../rules/state";
import { MAT, type Prefab } from "./builder";
import { Character, type Motion } from "./character";
import { LANE_W, ROAD_W, VIEW_FAR } from "./config";
import { buildBoss, buildItemPrefabs, buildObstaclePrefabs, hintMaterial, KIND_COLOR, OBSTACLE_HINT } from "./items3d";
import { QUALITY, type Quality, type QualitySettings } from "../core/quality";
import { Bruce } from "./bruce";
import { Dogs } from "./dogs";
import { Particles } from "./particles";
import { Symptoms } from "./post";
import { Scenery } from "./scenery";
import { Sky } from "./sky";

export type ViewMode = "menu" | "count" | "run" | "pause" | "quiz" | "over";

const TILE = 8; // comprimento de um ciclo das faixas pintadas na rua
const RAIN_DROPS = 500; // máximo; a qualidade escolhe quantas aparecem
const DUSK_SUN = new THREE.Color(0xff9a5a);
const BOSS_TYPES = ["lata", "burger"] as const;
const BRUCE_AT = 250 * UNITS_PER_METER;

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
  // marcas de pneu e trincas
  for (const lx of [-1, 0, 1]) {
    const x = ((lx * LANE_W) / ROAD_W + 0.5) * 256;
    g.fillStyle = "rgba(0,0,0,.05)";
    g.fillRect(x - 22, 0, 12, 256);
    g.fillRect(x + 10, 0, 12, 256);
  }
  g.strokeStyle = "rgba(25,28,34,.4)";
  g.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    let x = Math.random() * 256, y = Math.random() * 256;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 26; y += 6 + Math.random() * 14; g.lineTo(x, y); }
    g.stroke();
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

/** Lote de cópias de um modelo. */
interface Batch { mesh: THREE.InstancedMesh; n: number }
const BATCH_CAP = 24;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _p = new THREE.Vector3(), _s = new THREE.Vector3();

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
  /** Chamado quando o jogador passa sob o arco da UEPG. */
  set onArch(f: () => void) { this.scenery.onArch = f; }
  readonly dogs = new Dogs();
  readonly bruce = new Bruce();
  private bruceDone = false;
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
  private batches = new Map<string, Batch>();
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
  private particles = new Particles();
  private menuK = 1; // 1 = câmera do menu (de frente para o personagem), 0 = câmera da corrida
  private dip = 0; // câmera "afunda" ao pousar
  private punch = 0; // zoom rápido ao pegar power-up
  private baseFov = 66;
  private trailAcc = 0;
  private sweatAcc = 0;
  private q: QualitySettings = QUALITY.alta;
  private post = new Symptoms();
  private size = { w: 1, h: 1 };
  /** Câmera de perto (só desenvolvimento). */
  closeup: { x: number; y: number; z: number; lx?: number; ly?: number; lz?: number } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const s = this.scene;
    s.fog = new THREE.Fog(0xcdeefc, 60, VIEW_FAR);
    this.sun.position.set(-8, 14, 6);
    s.add(this.hemi, this.sun, this.sky.group, this.scenery.group, this.dogs.group, this.bruce.group, this.particles.points);

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

  private pool(id: string): Pool {
    let p = this.pools.get(id);
    if (p) return p;
    const prefab = this.obstaclePrefabs.get(id) as Prefab;
    p = new Pool(() => {
      const g = new THREE.Group();
      g.add(prefab.make());
      const hint = new THREE.Sprite(this.hintMats[id]);
      hint.scale.set(1.9, 0.48, 1);
      hint.position.y = OBSTACLE_HINT[id].y;
      g.userData.hint = hint;
      g.add(hint);
      return g;
    }, this.scene);
    this.pools.set(id, p);
    return p;
  }

  /** Lote: todas as cópias de um mesmo modelo são desenhadas de uma vez. */
  private batch(key: string, geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[]): Batch {
    let b = this.batches.get(key);
    if (!b) {
      const mesh = new THREE.InstancedMesh(geo, mat, BATCH_CAP);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.visible = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(mesh);
      b = { mesh, n: 0 };
      this.batches.set(key, b);
    }
    return b;
  }
  private itemBatch(id: string): Batch {
    const p = this.itemPrefabs.get(id) as Prefab;
    return this.batch(`i:${id}`, p.geo, MAT.base);
  }
  private haloBatch(kind: string): Batch { return this.batch(`h:${kind}`, this.haloGeo, this.halo(kind)); }
  private powerBatch(): Batch { return this.batch("pw", this.powerRingGeo, this.powerRingMat); }

  private add(b: Batch, x: number, y: number, z: number, ry: number, scale: number): void {
    if (b.n >= BATCH_CAP) return;
    _q.setFromAxisAngle(_up, ry);
    _m.compose(_p.set(x, y, z), _q, _s.setScalar(scale));
    b.mesh.setMatrixAt(b.n++, _m);
  }
  private flushBatches(): void {
    for (const b of this.batches.values()) {
      b.mesh.count = b.n;
      b.mesh.visible = b.n > 0;
      if (b.n) b.mesh.instanceMatrix.needsUpdate = true;
      b.n = 0;
    }
  }

  private drawItem(o: WorldObject, hypo: boolean, time: number): void {
    const def = item(o.type), x = o.lx * LANE_W, z = -o.z;
    this.add(this.itemBatch(o.type), x, 0.35 + o.y0 + Math.sin(time * 4 + o.id) * 0.1, z, time * 2 + o.id, 1.7);
    this.add(this.haloBatch(hypo && def.fast ? "fix" : def.k), x, 0.03, z, 0, 1);
    if (def.k === "pw") this.add(this.powerBatch(), x, 0.85 + o.y0, z, time * 3, 1);
  }

  /**
   * Prepara tudo uma vez, no menu: envia modelos e texturas à placa de vídeo e compila os desenhos.
   * Sem isso, cada coisa nova (bairro, raça, sintoma, arco) causaria uma engasgada no meio da corrida.
   */
  prewarm(): void {
    const undoScenery = this.scenery.prewarm();
    this.dogs.prewarm();
    for (const id of this.itemPrefabs.keys()) this.add(this.itemBatch(id), 0, 500, 0, 0, 1);
    for (const k of Object.keys(KIND_COLOR)) this.add(this.haloBatch(k), 0, 500, 0, 0, 1);
    this.add(this.powerBatch(), 0, 500, 0, 0, 1);
    this.flushBatches();
    const obstacles = [...this.obstaclePrefabs.keys()].map((id) => {
      const pool = this.pool(id), obj = pool.get();
      obj.position.set(0, 0, -30);
      return { pool, obj };
    });
    for (const g of Object.values(this.bosses)) { g.visible = true; g.position.set(0, 3, -30); }
    this.bruce.group.visible = true;
    this.bruce.group.position.set(0, 0, -30);
    this.rain.visible = true;
    this.plateTint.visible = true;
    this.quizShield.visible = true;
    this.insulinRing.visible = true;
    this.camera.position.set(0, 5, 8);
    this.camera.lookAt(0, 1, -12);
    this.sky.update(lightAt(0), 0, this.camera);
    this.post.render(this.renderer, this.scene, this.camera); // variação usada nos sintomas
    this.renderer.render(this.scene, this.camera); // variação normal
    undoScenery();
    this.bruce.group.visible = false;
    for (const { pool, obj } of obstacles) pool.release(obj);
  }

  setSkin(skin: SkinId): void {
    this.hero.setSkin(skin);
  }

  resize(w: number, h: number): void {
    this.size = { w, h };
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pixelRatio));
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.portrait = aspect < 0.85;
    this.camera.aspect = aspect;
    // Em pé, a câmera abre mais o ângulo e recua um pouco para caberem as três faixas.
    this.baseFov = this.portrait ? 66 : 56;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    const buf = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.particles.setViewport(buf.y, this.baseFov);
    // o sintoma borra a imagem de qualquer forma: desenhar em tamanho menor deixa bem mais leve
    this.post.setSize(Math.round(buf.x * 0.7), Math.round(buf.y * 0.7));
  }

  /** Aplica um nível de qualidade gráfica (nitidez, chuva, partículas, distância do cenário). */
  setQuality(level: Quality): void {
    this.q = QUALITY[level];
    this.particles.density = this.q.particles;
    this.scenery.rich = level !== "baixa";
    this.dogs.rich = level !== "baixa";
    (this.rain.geometry as THREE.BufferGeometry).setDrawRange(0, this.q.rain * 2);
    const fog = this.scene.fog as THREE.Fog;
    fog.far = this.q.viewFar;
    fog.near = Math.min(60, this.q.viewFar * 0.45);
    this.camera.far = this.q.viewFar + 25;
    this.sky.group.scale.setScalar((this.q.viewFar + 15) / (VIEW_FAR + 10)); // o céu cabe dentro da distância de desenho
    this.resize(this.size.w, this.size.h);
  }

  /** Sintomas na visão: hipo = turva e dupla; hiper = embaçada e amarelada. */
  setSymptoms(g: number | null): void {
    const P = this.post;
    // hipo: quanto mais baixa a glicemia, mais turva e mais dupla a visão
    const lo = g != null && g < TARGET_LOW ? Math.min(1, 0.35 + (TARGET_LOW - g) / 30) : 0;
    const hi = g != null && g > TARGET_HIGH ? Math.min(1, (g - TARGET_HIGH) / 110 + 0.25) : 0;
    P.ghost = lo;
    P.blur = Math.max(hi, lo * 0.7);
    P.warm = hi * 0.9;
  }

  /** Dr. Bruce atravessa a rua à frente do jogador, num trecho livre da calçada. */
  startBruce(s: GameState): void {
    this.bruceDone = true;
    this.bruce.start(Math.floor((s.dist + 62) / 20) * 20 + 12.2, s.dist, s.runSpeed);
  }

  /** O arco nasce logo depois do trecho já visível, para o campus aparecer inteiro. */
  placeArch(dist: number): void {
    this.scenery.placeArch(dist + this.q.viewFar + 75);
  }

  /** Efeitos visuais dos acontecimentos do jogo. */
  private react(e: GameEvent, s: GameState): void {
    const x = s.px * LANE_W, P = this.particles;
    switch (e.type) {
      case "hit":
      case "glucoseLife":
        this.shake = 0.45;
        this.hero.hit();
        P.emit(x, 1.0, -0.4, 0xff9a3c, 18, { speed: 4, up: 3, size: 0.13, life: 0.5 });
        P.emit(x, 0.1, 0, 0xc9c2b5, 10, { speed: 2, up: 1, size: 0.2, life: 0.6, grav: 2 });
        break;
      case "day":
        if (e.day % 5 === 0) this.placeArch(s.dist); // arco da UEPG a cada 5 dias
        break;
      case "shieldBlock":
        P.emit(x, 1.0, -0.3, 0x5ad1a8, 24, { speed: 4, up: 2, size: 0.12 });
        break;
      case "jump":
        if (e.double) { this.hero.flip(); P.emit(x, s.y + 0.2, 0, 0xffffff, 10, { speed: 2, up: -1, size: 0.1, life: 0.4, grav: 0 }); }
        break;
      case "land":
        this.dip = 0.12;
        P.emit(x, 0.05, 0.1, 0xc9c2b5, 8, { speed: 1.6, up: 0.6, size: 0.18, life: 0.45, grav: 1.5 });
        break;
      case "slide":
        P.emit(x, 0.05, 0.2, 0xc9c2b5, 10, { speed: 1.4, up: 0.5, size: 0.2, life: 0.5, grav: 1, vz: 2 });
        break;
      case "collect": {
        const it = item(e.obj.type);
        const col = e.effect === "fix" || e.effect === "insulin" ? KIND_COLOR.fix : KIND_COLOR[it.k];
        const big = e.effect === "power" || e.effect === "ex";
        P.emit(x, 1.0 + s.y, -0.3, col, big ? 26 : 14, { speed: big ? 3.5 : 2.5, up: 2.5, size: big ? 0.14 : 0.11, life: 0.55, vz: 2 });
        if (e.effect === "power") { this.punch = 1; P.emit(x, 1.0 + s.y, -0.3, 0xffffff, 10, { speed: 4, up: 3, size: 0.08 }); }
        break;
      }
      case "bossEnd":
      case "plateEnd":
      case "quizEnd": {
        const ok = e.type === "quizEnd" ? e.ok : e.win;
        if (!ok) break;
        this.hero.cheer();
        for (const c of [0xe2483d, 0xf2c230, 0x2fa866, 0x2f7fe0, 0xff6fa8]) P.emit(x, 2.2, -0.5, c, 10, { speed: 3, up: 4, size: 0.11, life: 1.2, grav: 5 });
        break;
      }
    }
  }

  private resetDrop(i: number, y = 10 + Math.random() * 3): void {
    const x = (Math.random() - 0.5) * 16, z = -Math.random() * 30 + 4;
    this.rainPos.set([x, y, z, x + 0.12, y - 0.55, z], i * 6);
  }

  update(s: GameState, events: GameEvent[], dt: number, time: number, mode: ViewMode): void {
    for (const e of events) this.react(e, s);
    const L = lightAt(s.t);
    const night = L.n;

    // jogador
    const hypo = s.g < TARGET_LOW, hyper = s.g > TARGET_HIGH;
    const x = s.px * LANE_W;
    this.player.position.set(x, s.y, 0);
    const playing = mode !== "menu";
    const uiDt = Math.max(dt, mode === "menu" || mode === "count" || mode === "over" ? 1 / 60 : 0);
    this.turn += ((playing ? 0 : Math.PI) - this.turn) * Math.min(1, uiDt * 5);
    this.player.rotation.y = this.turn;
    this.fat += (1 - s.cond / 100 - this.fat) * Math.min(1, dt * 1.5);
    this.hero.setFat(this.fat);
    let motion: Motion = "run";
    if (mode === "menu" || mode === "count") motion = "idle";
    else if (mode === "over") motion = "tired";
    else if (s.slide > 0 && s.y < 0.3) motion = "slide";
    else if (s.y > 0.02) motion = s.vy > 0 ? "jump" : "fall";
    const animDt = mode === "pause" || mode === "quiz" ? 0 : uiDt;
    this.hero.update(animDt, { motion, speed: s.runSpeed, lean: playing ? s.lane - s.px : 0, hypo: playing && hypo, hyper: playing && hyper });
    this.player.visible = !(s.inv > 0 && mode === "run" && Math.floor(time * 14) % 2 === 0);
    this.quizShield.visible = s.shield > 0 && playing;
    this.insulinRing.visible = s.insShield && playing;
    this.insulinRing.rotation.z = time * 2;
    this.shadow.position.x = x;
    const sh = (1 / (1 + s.y * 0.5)) * (0.9 + this.fat * 0.35);
    this.shadow.scale.set(sh, sh, sh);

    // cenário, rua e prato
    this.scenery.update(s.dist, night, this.q.viewFar);
    this.dogs.update(s.dist, mode === "pause" || mode === "quiz" ? 0 : uiDt, this.q.viewFar, mode === "run");
    // Dr. Bruce aos 250 m; se o quiz estiver para abrir, ele espera para ninguém perder a cena
    if (mode === "count" || mode === "menu") { this.bruceDone = false; this.bruce.stop(); }
    if (mode === "run" && !this.bruceDone && s.dist >= BRUCE_AT && s.quizT > 3) this.startBruce(s);
    this.bruce.update(s.dist, mode === "run" ? dt : 0);
    this.roadTex.offset.y = (s.dist / TILE) % 1;
    this.roadMat.color.setScalar(1 - s.rain * 0.28); // pista molhada fica mais escura
    this.plateTint.visible = !!s.plate && playing;
    MAT.glow.emissiveIntensity = Math.min(1, night * 1.1 + L.d * 0.25);

    // objetos do jogo
    for (const e of this.live.values()) e.obj.userData.seen = false;
    if (playing) {
      for (const o of s.objs) {
        if (o.kind === "item") {
          if (!o.done) this.drawItem(o, hypo, time);
          continue;
        }
        let entry = this.live.get(o.id);
        if (!entry) {
          const pool = this.pool(o.type);
          entry = { obj: pool.get(), pool, key: o.type };
          this.live.set(o.id, entry);
        }
        entry.obj.userData.seen = true;
        this.place(entry.obj, o, s);
      }
    }
    for (const [id, e] of this.live) if (!e.obj.userData.seen) { e.pool.release(e.obj); this.live.delete(id); }
    this.flushBatches();

    // chefão
    for (const type of BOSS_TYPES) {
      const g = this.bosses[type], B = s.boss;
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
    this.sun.color.copy(this.tmp.setHex(0xfff4e0).lerp(DUSK_SUN, L.d * 0.7));

    // chuva
    const rm = this.rain.material as THREE.LineBasicMaterial;
    rm.opacity = 0.55 * s.rain;
    this.rain.visible = s.rain > 0.03 && playing;
    if (this.rain.visible && dt > 0) {
      const p = this.rainPos;
      const fall = 22 * dt;
      for (let i = 0; i < this.q.rain; i++) {
        const k = i * 6;
        p[k + 1] -= fall; p[k + 4] -= fall;
        p[k] -= fall * 0.2; p[k + 3] -= fall * 0.2;
        if (p[k + 4] < 0) this.resetDrop(i);
      }
      this.rain.position.x = this.camX;
      (this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // partículas contínuas: rastro brilhante na faixa-alvo e suor na hipo/hiper
    if (mode === "run" && dt > 0) {
      const P = this.particles;
      if (zoneOf(s.g) === "g" && s.y < 0.05 && s.slide <= 0 && (this.trailAcc += dt * 26) >= 1) {
        for (; this.trailAcc >= 1; this.trailAcc--) P.emit(x + (Math.random() - 0.5) * 0.4, 0.06, 0.2, Math.random() < 0.5 ? 0x9dffb9 : 0xfff6a8, 1, { speed: 0.4, up: 0.8, size: 0.1, life: 0.5, grav: 0, vz: s.runSpeed * 0.35 });
      }
      if ((hypo || hyper) && (this.sweatAcc += dt * 7) >= 1) {
        this.sweatAcc--;
        P.emit(x + (Math.random() - 0.5) * 0.3, s.y + 1.7, 0.05, 0x7fd0ff, 1, { speed: 0.6, up: 1, size: 0.07, life: 0.6, grav: 5 });
      }
    }
    this.particles.update(mode === "pause" || mode === "quiz" ? 0 : uiDt);

    // câmera: no menu fica de frente para o personagem; na corrida segue com atraso suave
    this.menuK += ((mode === "menu" ? 1 : 0) - this.menuK) * Math.min(1, uiDt * 2.2);
    const m = this.menuK * this.menuK * (3 - 2 * this.menuK);
    this.camX += (x * 0.7 - this.camX) * Math.min(1, dt * 6);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.dip = Math.max(0, this.dip - dt * 0.8);
    this.punch = Math.max(0, this.punch - dt * 2.5);
    const sk = this.shake * this.shake;
    const back = this.portrait ? 7.6 : 6.4, up = this.portrait ? 5.6 : 4.0;
    const gx = this.camX + (Math.random() - 0.5) * sk, gy = up + s.y * 0.35 - this.dip + (Math.random() - 0.5) * sk;
    const mx = x + (this.portrait ? 0.9 : 1.6), my = this.portrait ? 1.55 : 1.3, mz = this.portrait ? 4.6 : 3.6;
    this.camera.position.set(gx + (mx - gx) * m, gy + (my - gy) * m, back + (mz - back) * m);
    const lx = this.camX * 0.9, ly = (this.portrait ? 0 : 0.5) + s.y * 0.25, lz = this.portrait ? -9 : -12;
    const tx = x + (this.portrait ? 0.15 : 0.9), ty = this.portrait ? 0.45 : 0.95;
    this.camera.lookAt(lx + (tx - lx) * m, ly + (ty - ly) * m, lz + (0 - lz) * m);
    // sensação de velocidade: o ângulo abre conforme acelera
    const fov = this.baseFov + Math.min(6, Math.max(0, s.runSpeed - 18) * 0.25) * (1 - m) + this.punch * 4;
    if (Math.abs(fov - this.camera.fov) > 0.05) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    if (this.closeup) {
      // só para conferir o personagem de perto durante o desenvolvimento
      this.camera.position.set(x + this.closeup.x, s.y + this.closeup.y, this.closeup.z);
      this.camera.lookAt(x + (this.closeup.lx ?? 0), s.y + (this.closeup.ly ?? 0.9), this.closeup.lz ?? 0);
    }

    this.sky.update(L, s.rain, this.camera);
    (this.scene.fog as THREE.Fog).color.copy(this.sky.horizon);
    if (this.post.active) this.post.render(this.renderer, this.scene, this.camera);
    else this.renderer.render(this.scene, this.camera);
  }

  private place(g: THREE.Object3D, o: WorldObject, s: GameState): void {
    g.position.set(o.lx * LANE_W, 0, -o.z);
    const hint = g.userData.hint as THREE.Sprite;
    hint.material = this.hintMats[o.type === "pilha" && s.turbo > 0 ? "pilhaTurbo" : o.type];
    hint.visible = o.z > 3;
  }

  /** Quantas chamadas de desenho o último quadro usou (para medir desempenho). */
  get drawCalls(): number { return this.renderer.info.render.calls; }
}
