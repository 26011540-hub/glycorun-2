import * as THREE from "three";
import type { GameEvent, GameState, WorldObject } from "../rules/state";
import { COLORS, LANE_W, ROAD_W, VIEW_FAR } from "./config";

// Etapa 1: cena com formas simples. Na etapa 3 os blocos viram modelos low-poly.

const TILE = 8; // comprimento de um ciclo das faixas pintadas na rua
const PROP_SPACING = 9;
const PROPS_PER_SIDE = Math.ceil(VIEW_FAR / PROP_SPACING) + 2;

function laneTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#5d6574";
  g.fillRect(0, 0, 128, 256);
  // faixas tracejadas entre as pistas
  g.fillStyle = "#f3eed9";
  const edge = (0.4 / ROAD_W) * 128;
  for (const lx of [-0.5, 0.5]) {
    const x = ((lx * LANE_W) / ROAD_W + 0.5) * 128;
    g.fillRect(x - 2.5, 0, 5, 120);
  }
  // meio-fio
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
  private player = new THREE.Group();
  private body: THREE.Mesh;
  private shadow: THREE.Mesh;
  private props: THREE.Object3D[] = [];
  private pools: Record<string, Pool> = {};
  private live = new Map<number, { mesh: THREE.Object3D; pool: Pool }>();
  private camX = 0;
  private shake = 0;
  private squash = 0; // achatamento ao pousar
  private portrait = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const s = this.scene;
    s.background = new THREE.Color(COLORS.sky);
    s.fog = new THREE.Fog(COLORS.fog, 55, VIEW_FAR);
    s.add(new THREE.HemisphereLight(0xffffff, 0x6b8f5a, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-6, 12, 6);
    s.add(sun);

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

    // casas e árvores laterais, recicladas conforme a corrida avança
    const houseGeo = new THREE.BoxGeometry(1, 1, 1);
    houseGeo.translate(0, 0.5, 0);
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.16, 1.2, 6);
    trunkGeo.translate(0, 0.6, 0);
    const crownGeo = new THREE.IcosahedronGeometry(0.9, 0);
    crownGeo.translate(0, 1.9, 0);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6e4a2e });
    const crownMat = new THREE.MeshLambertMaterial({ color: 0x3f9a49, flatShading: true });
    const pastel = [0xf2c6a0, 0xa8d5e2, 0xf7e3a1, 0xc4e3b5, 0xf3b8c4, 0xd9c7f0];
    for (const side of [-1, 1]) {
      for (let i = 0; i < PROPS_PER_SIDE; i++) {
        let o: THREE.Object3D;
        if (i % 3 === 2) {
          o = new THREE.Group();
          o.add(new THREE.Mesh(trunkGeo, trunkMat), new THREE.Mesh(crownGeo, crownMat));
          o.position.x = side * (ROAD_W / 2 + 1.6);
        } else {
          const h = 2.6 + ((i * 37) % 7) * 0.35;
          o = new THREE.Mesh(houseGeo, new THREE.MeshLambertMaterial({ color: pastel[(i + (side > 0 ? 3 : 0)) % pastel.length] }));
          o.scale.set(3.2, h, 6.5);
          o.position.x = side * (ROAD_W / 2 + 4.2);
        }
        o.userData.base = i * PROP_SPACING + (side > 0 ? PROP_SPACING / 2 : 0);
        this.props.push(o);
        s.add(o);
      }
    }

    // jogador (placeholder: cápsula + cabeça)
    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.75, 4, 10), new THREE.MeshLambertMaterial({ color: COLORS.player }));
    this.body.position.y = 0.7;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshLambertMaterial({ color: COLORS.skin }));
    head.position.y = 1.5;
    const torso = new THREE.Group();
    torso.add(this.body, head);
    this.player.add(torso);
    this.player.userData.torso = torso;
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.01;
    s.add(this.player, this.shadow);

    this.buildPools();
  }

  private buildPools(): void {
    const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c });
    const sofaMat = lam(COLORS.sofa), darkMat = lam(0x8e342e);
    const telaMat = lam(COLORS.tela), frameMat = lam(0x1b2230), postMat = lam(0x3b4250);
    const pilhaMat = lam(COLORS.pilha), screenMats = [lam(0xff7a59), lam(0x5ad1a8), lam(0xffd166)];
    const itemGeo = new THREE.IcosahedronGeometry(0.34, 1);
    const itemMat = new THREE.MeshLambertMaterial({ color: COLORS.item, emissive: 0x1a5c33, flatShading: true });
    const box = (w: number, h: number, d: number, m: THREE.Material, y: number) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.y = y;
      return b;
    };
    this.pools.sofa = new Pool(() => {
      const g = new THREE.Group();
      g.add(box(1.8, 0.45, 1.0, sofaMat, 0.3), box(1.8, 0.5, 0.25, darkMat, 0.75), box(0.25, 0.55, 1.0, darkMat, 0.35));
      g.children[2].position.x = -0.85;
      const arm = box(0.25, 0.55, 1.0, darkMat, 0.35);
      arm.position.x = 0.85;
      g.children[1].position.z = -0.38;
      g.add(arm);
      return g;
    }, this.scene);
    this.pools.tela = new Pool(() => {
      const g = new THREE.Group();
      const l = box(0.1, 2.35, 0.1, postMat, 1.17), r = box(0.1, 2.35, 0.1, postMat, 1.17);
      l.position.x = -0.95;
      r.position.x = 0.95;
      g.add(l, r, box(1.95, 1.0, 0.15, frameMat, 1.75), box(1.75, 0.82, 0.05, telaMat, 1.75));
      g.children[3].position.z = 0.08;
      return g;
    }, this.scene);
    this.pools.pilha = new Pool(() => {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        g.add(box(1.7, 0.78, 0.9, pilhaMat, 0.4 + i * 0.8));
        const sc = box(1.45, 0.55, 0.05, screenMats[i], 0.4 + i * 0.8);
        sc.position.z = 0.46;
        g.add(sc);
      }
      return g;
    }, this.scene);
    this.pools.orb = new Pool(() => new THREE.Mesh(itemGeo, itemMat), this.scene);
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

  update(s: GameState, events: GameEvent[], dt: number, time: number): void {
    for (const e of events) {
      if (e.type === "hit") this.shake = 0.45;
      if (e.type === "land") this.squash = 1;
    }

    // jogador
    const x = s.px * LANE_W;
    this.player.position.set(x, s.y, 0);
    const torso = this.player.userData.torso as THREE.Group;
    const sliding = s.slide > 0 && s.y < 0.05;
    const run = s.y > 0 ? 0 : Math.abs(Math.sin(time * 12));
    this.squash = Math.max(0, this.squash - dt * 6);
    const sy = sliding ? 0.5 : 1 - this.squash * 0.18 + run * 0.04;
    torso.scale.set(sliding ? 1.15 : 1 + this.squash * 0.12, sy, 1);
    torso.position.y = run * 0.08;
    torso.rotation.z = -(s.lane - s.px) * 0.45; // inclina para o lado da troca de faixa
    torso.rotation.x = sliding ? -0.5 : s.vy > 0 ? -0.15 : 0;
    this.player.visible = !(s.inv > 0 && Math.floor(time * 14) % 2 === 0);
    this.shadow.position.x = x;
    const sh = 1 / (1 + s.y * 0.5);
    this.shadow.scale.set(sh, sh, sh);

    // casas e árvores
    const loop = PROPS_PER_SIDE * PROP_SPACING;
    for (const p of this.props) {
      const ahead = (((p.userData.base as number) - s.dist) % loop + loop) % loop - 8;
      p.position.z = -ahead;
    }
    this.roadTex.offset.y = (s.dist / TILE) % 1;

    // objetos do jogo
    const seen = new Set<number>();
    for (const o of s.objs) {
      if (o.done && o.kind === "item") continue;
      seen.add(o.id);
      let entry = this.live.get(o.id);
      if (!entry) {
        const pool = this.pools[o.type] ?? this.pools.orb;
        entry = { mesh: pool.get(), pool };
        this.live.set(o.id, entry);
      }
      this.place(entry.mesh, o, time);
    }
    for (const [id, entry] of this.live) {
      if (!seen.has(id)) {
        entry.pool.release(entry.mesh);
        this.live.delete(id);
      }
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

  private place(m: THREE.Object3D, o: WorldObject, time: number): void {
    m.position.set(o.lx * LANE_W, 0, -o.z);
    if (o.kind === "item") {
      m.position.y = 0.95 + Math.sin(time * 4 + o.id) * 0.12;
      m.rotation.y = time * 2 + o.id;
    }
  }
}
