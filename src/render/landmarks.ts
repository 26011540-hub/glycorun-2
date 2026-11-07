import * as THREE from "three";
import { Builder, Prefab } from "./builder";

/**
 * Arco de entrada da UEPG, feito do zero com uma foto como referência (homenagem do jogo à universidade).
 * Decisão do autor: o nome aparece em letras próprias, sem reproduzir o logo oficial.
 * Centro da rua em x = 0; a frente (com os letreiros) olha para +z, na direção de quem chega.
 * A viga fica acima da câmera mesmo no pulo duplo, e os pilares ficam fora da pista e da calçada.
 */

const NAVY = 0x1c3a6e;
const BLUE = 0x7fb2e0;
const BLUE_D = 0x5e93c8;
const WHITE = 0xf6f4ee;
const STEEL = 0x2b3038;
const GLASS = 0x9fd3ee;

const BEAM_Y = 8.3, BEAM_H = 1.6, BEAM_X0 = -10.5, BEAM_X1 = 13;

function beamTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 140;
  const g = c.getContext("2d")!;
  const W = 2048, span = BEAM_X1 - BEAM_X0;
  const px = (x: number) => ((x - BEAM_X0) / span) * W; // posição na viga → pixel
  g.fillStyle = "#1c3a6e";
  g.fillRect(0, 0, W, 140);
  g.fillStyle = "#16305c";
  g.fillRect(0, 124, W, 16);
  g.fillStyle = "#f4f2ea";
  g.textBaseline = "middle";
  // os textos ficam no trecho sobre a rua: é o que aparece na tela do celular em pé
  g.textAlign = "right";
  g.font = '800 92px "Fredoka", system-ui, sans-serif';
  g.fillText("UEPG", px(-1.9), 68);
  g.fillStyle = "#6fb7ea";
  g.fillRect(px(-1.72), 26, 5, 86);
  g.fillStyle = "#f4f2ea";
  g.textAlign = "left";
  g.font = '700 25px Georgia, "Times New Roman", serif';
  for (const [i, t] of ["Universidade", "Estadual de", "Ponta Grossa"].entries()) g.fillText(t, px(-1.5), 38 + i * 31);
  g.font = '700 38px Georgia, "Times New Roman", serif';
  g.fillText("State University of Ponta Grossa", px(0.75), 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function stopTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c8201c";
  g.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) / 8) * Math.PI * 2;
    g.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62);
  }
  g.closePath();
  g.fill();
  g.strokeStyle = "#fff";
  g.lineWidth = 5;
  g.stroke();
  g.fillStyle = "#fff";
  g.font = '800 40px system-ui, "Segoe UI", sans-serif';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("PARE", 64, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function archModel(): Builder {
  const b = new Builder();
  const midX = (BEAM_X0 + BEAM_X1) / 2, span = BEAM_X1 - BEAM_X0;
  // viga principal com a estrutura de aço por baixo
  b.box(span, BEAM_H, 2.2, NAVY, { x: midX, y: BEAM_Y, flat: true });
  b.box(span + 0.2, 0.12, 2.3, 0x16305c, { x: midX, y: BEAM_Y + BEAM_H / 2 + 0.03, flat: true });
  b.box(span, 0.16, 1.9, STEEL, { x: midX, y: BEAM_Y - BEAM_H / 2 - 0.08, flat: true });
  for (let k = 0; k < 16; k++) {
    const x = BEAM_X0 + 0.8 + k * 1.42;
    b.box(0.06, 0.6, 0.06, 0xb98a2e, { x, y: BEAM_Y - BEAM_H / 2 - 0.4, z: 0.72, rz: k % 2 ? 0.7 : -0.7, flat: true });
    b.box(0.06, 0.6, 0.06, 0xb98a2e, { x, y: BEAM_Y - BEAM_H / 2 - 0.4, z: -0.72, rz: k % 2 ? 0.7 : -0.7, flat: true });
  }
  b.box(span, 0.06, 0.06, STEEL, { x: midX, y: BEAM_Y - BEAM_H / 2 - 0.62, z: 0.72, flat: true });
  b.box(span, 0.06, 0.06, STEEL, { x: midX, y: BEAM_Y - BEAM_H / 2 - 0.62, z: -0.72, flat: true });

  // pilares do lado esquerdo
  b.box(1.9, BEAM_Y, 3.6, BLUE, { x: -7.4, y: BEAM_Y / 2 });
  b.box(1.5, BEAM_Y, 2.8, BLUE_D, { x: -9.5, y: BEAM_Y / 2, ry: 0.28 });

  // guarita redonda de dois andares, à direita
  const gx = 9.4;
  b.cyl(2.5, 2.5, 3.0, 18, BLUE, { x: gx, y: 1.5 });
  b.cyl(2.85, 2.85, 0.32, 18, BLUE_D, { x: gx, y: 3.1, flat: true });
  b.cyl(2.5, 2.5, 2.3, 18, BLUE, { x: gx, y: 4.35 });
  b.cyl(2.85, 2.85, 0.3, 18, 0x4d7fb5, { x: gx, y: 5.6, flat: true });
  for (const [y, h] of [[1.7, 1.9], [4.35, 1.6]] as const) {
    for (let k = 0; k < 9; k++) {
      const a = Math.PI * 0.42 + (k / 9) * Math.PI * 1.18; // janelas voltadas para a rua e para quem chega
      const x = gx + Math.cos(a) * 2.52, z = Math.sin(a) * 2.52;
      b.box(0.08, h, 0.92, GLASS, { x, y, z, ry: -a, glow: true });
      b.box(0.1, h + 0.1, 0.07, WHITE, { x: gx + Math.cos(a + 0.17) * 2.55, y, z: Math.sin(a + 0.17) * 2.55, ry: -a, flat: true });
    }
  }
  // torre alta atrás da guarita, passando da viga
  b.box(3.8, 11.4, 3.2, BLUE, { x: gx + 0.2, y: 5.7, z: -2.6 });
  b.box(3.9, 0.2, 3.3, BLUE_D, { x: gx + 0.2, y: 11.45, z: -2.6, rz: -0.14, flat: true });
  // onda branca e azul sobre a viga (forma genérica)
  for (let k = 0; k < 12; k++) {
    const t = k / 11, x = 6.2 + t * 6, y = BEAM_Y + 1.1 + Math.sin(t * Math.PI * 1.4) * 0.9, a = Math.cos(t * Math.PI * 1.4) * 0.72;
    const w = 0.72 - Math.abs(t - 0.45) * 0.72;
    b.box(0.68, 0.5 + w, 0.22, WHITE, { x, y: y - 0.5, z: 1.0, rz: a, flat: true });
    b.box(0.68, 0.34 + w * 0.7, 0.2, 0x3f8fd8, { x: x - 0.25, y: y + 0.42, z: 0.86, rz: a, flat: true });
  }
  // grades, cones e canteiros da portaria
  for (let k = 0; k < 8; k++) b.box(0.06, 1.1, 0.06, 0xdfe5ea, { x: 6.6, y: 0.55, z: 2.2 + k * 0.42 });
  for (let k = 0; k < 7; k++) b.box(0.05, 1.05, 0.05, 0xdfe5ea, { x: 6.8 + k * 0.42, y: 0.52, z: 5.3 });
  b.box(0.05, 0.06, 3.1, 0xdfe5ea, { x: 6.6, y: 1.08, z: 3.7, flat: true });
  b.box(2.8, 0.06, 0.05, 0xdfe5ea, { x: 8.1, y: 1.05, z: 5.3, flat: true });
  for (const z of [1.8, 3.2]) {
    b.cone(0.17, 0.55, 8, 0xf08a3c, { x: 5.7, y: 0.34, z });
    b.cyl(0.11, 0.135, 0.09, 8, WHITE, { x: 5.7, y: 0.36, z, flat: true });
    b.box(0.42, 0.05, 0.42, 0x23262c, { x: 5.7, y: 0.09, z, flat: true });
  }
  for (const [x, z, r] of [[-11.5, 3.5, 2.2], [-8, 4.5, 1.2], [12.5, 4, 2.6], [15, 1, 2.2]] as const) b.ball(r, 0x6fbf4a, { x, y: 0.1, z, sy: 0.32, flat: true }, 1); // gramado em morrinhos
  // placa PARE (a face vermelha é uma textura à parte)
  b.cyl(0.05, 0.05, 2.5, 6, 0xdfe5ea, { x: 5.0, y: 1.25, z: 5.2 });
  return b;
}

export class Arch {
  readonly group = new THREE.Group();

  constructor() {
    this.group.add(Prefab.of(archModel()).make());
    const beam = new THREE.Mesh(
      new THREE.PlaneGeometry(BEAM_X1 - BEAM_X0, BEAM_H),
      new THREE.MeshBasicMaterial({ map: beamTexture() }),
    );
    beam.position.set((BEAM_X0 + BEAM_X1) / 2, BEAM_Y, 1.115);
    const stop = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: stopTexture(), transparent: true }));
    stop.position.set(5.0, 2.55, 5.26);
    this.group.add(beam, stop);
  }
}
