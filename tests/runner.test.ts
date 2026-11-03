import { describe, expect, it } from "vitest";
import { createGame } from "../src/rules/state";
import { act, step } from "../src/rules/step";
import { createRng } from "../src/rules/rng";
import type { GameState, ObstacleType } from "../src/rules/state";

const rng = createRng(1);

/** Coloca um obstáculo à frente e corre até ele passar. */
function runInto(s: GameState, type: ObstacleType, before: (s: GameState) => void, lead = 6) {
  s.nextRow = 1e9; // sem fileiras aleatórias
  s.objs.push({ id: 999, kind: "obs", type, lx: 0, z: lead, y0: 0, done: false });
  let acted = false;
  for (let i = 0; i < 240; i++) {
    const o = s.objs.find((x) => x.id === 999);
    if (!acted && o && o.z < 3.2) { before(s); acted = true; }
    step(s, 1 / 60, rng);
  }
}

describe("corredor", () => {
  it("troca de faixa e não passa das bordas", () => {
    const s = createGame(false);
    act(s, "L"); act(s, "L");
    expect(s.lane).toBe(-1);
    act(s, "R"); act(s, "R"); act(s, "R");
    expect(s.lane).toBe(1);
    for (let i = 0; i < 60; i++) step(s, 1 / 60, rng);
    expect(s.px).toBeCloseTo(1, 2);
  });

  it("pula e volta ao chão", () => {
    const s = createGame(false);
    act(s, "U");
    let peak = 0;
    for (let i = 0; i < 120; i++) { step(s, 1 / 60, rng); peak = Math.max(peak, s.y); }
    expect(peak).toBeGreaterThan(1.2);
    expect(s.y).toBe(0);
  });

  it("pular passa pelo sofá; ficar parado bate", () => {
    const a = createGame(false);
    runInto(a, "sofa", (s) => act(s, "U"));
    expect(a.lives).toBe(3);
    const b = createGame(false);
    runInto(b, "sofa", () => {});
    expect(b.lives).toBe(2);
  });

  it("abaixar passa pela tela; pular não", () => {
    const a = createGame(false);
    runInto(a, "tela", (s) => act(s, "D"), 4);
    expect(a.lives).toBe(3);
    const b = createGame(false);
    runInto(b, "tela", (s) => act(s, "U"));
    expect(b.lives).toBe(2);
  });

  it("pilha de telas: só desviando (ou pulo duplo)", () => {
    const a = createGame(false);
    runInto(a, "pilha", (s) => act(s, "U"));
    expect(a.lives).toBe(2);
    const b = createGame(false);
    runInto(b, "pilha", (s) => act(s, "L"));
    expect(b.lives).toBe(3);
  });

  it("três batidas encerram a corrida", () => {
    const s = createGame(false);
    for (let k = 0; k < 3; k++) { s.inv = 0; runInto(s, "pilha", () => {}); }
    expect(s.lives).toBe(0);
    expect(s.over).toBe(true);
  });

  it("acelera com o tempo, mais suave no toque", () => {
    const pc = createGame(false), cel = createGame(true);
    pc.nextRow = cel.nextRow = 1e9;
    for (let i = 0; i < 60 * 60; i++) {
      for (const s of [pc, cel]) { s.g = 100; s.quizT = 99; step(s, 1 / 60, rng); }
    }
    expect(pc.speed).toBeCloseTo(28.2, 0);
    expect(cel.speed).toBeCloseTo(25.8, 0);
  });
});
