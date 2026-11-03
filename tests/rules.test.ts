import { describe, expect, it } from "vitest";
import { createGame, timeInRange, type GameState } from "../src/rules/state";
import { step } from "../src/rules/step";
import { collect } from "../src/rules/collect";
import { zoneOf } from "../src/rules/glucose";
import { answerQuiz, closeQuiz, QuizDeck } from "../src/rules/quiz";
import { achievements, addToBoard, loadBoard } from "../src/rules/scoring";
import { lightAt } from "../src/rules/environment";
import { createRng } from "../src/rules/rng";
import { QUESTIONS } from "../src/content/quiz";

const rng = createRng(7);
let nid = 1000;
const obj = (type: string, extra = {}) => ({ id: nid++, kind: "item" as const, type, lx: 0, z: 0, y0: 0, done: true, ...extra });

/** Avança só a glicemia/tempo, sem objetos nem quiz. */
function run(s: GameState, sec: number) {
  s.nextRow = 1e9;
  for (let i = 0; i < sec * 60; i++) { s.quizT = 99; step(s, 1 / 60, rng); }
}

describe("glicemia", () => {
  it("zonas com faixa-alvo 70–140", () => {
    expect(zoneOf(53)).toBe("r");
    expect(zoneOf(54)).toBe("y");
    expect(zoneOf(69)).toBe("y");
    expect(zoneOf(70)).toBe("g");
    expect(zoneOf(140)).toBe("g");
    expect(zoneOf(141)).toBe("y");
    expect(zoneOf(250)).toBe("y");
    expect(zoneOf(251)).toBe("r");
  });

  it("cai sozinha cerca de 1,1 mg/dL por segundo", () => {
    const s = createGame(false);
    run(s, 10);
    expect(s.g).toBeCloseTo(89, 0);
  });

  it("ultraprocessado dá pico de 42 em 1,4 s; com exercício recente o pico cai pela metade", () => {
    const a = createGame(false);
    collect(a, obj("burger"));
    run(a, 2);
    expect(a.g).toBeCloseTo(100 + 42 - 2.2, 0);
    const b = createGame(false);
    b.boost = 7;
    collect(b, obj("burger"));
    run(b, 2);
    expect(b.g).toBeLessThan(a.g - 18);
  });

  it("na hipoglicemia, carboidrato rápido é a correção certa (regra dos 15)", () => {
    const s = createGame(false);
    s.g = 60;
    collect(s, obj("refri"));
    const t = s.events.find((e) => e.type === "collect");
    expect(t && t.type === "collect" && t.effect).toBe("fix");
    run(s, 2);
    expect(s.g).toBeGreaterThan(90);
  });

  it("Escudo de Insulina segura um ultraprocessado", () => {
    const s = createGame(false);
    s.insShield = true;
    collect(s, obj("donut"));
    expect(s.insShield).toBe(false);
    run(s, 2);
    expect(s.g).toBeLessThan(110);
  });

  it("Água Turbo só baixa na glicemia alta (acima de 140)", () => {
    const a = createGame(false);
    a.g = 200;
    collect(a, obj("aguaT"));
    run(a, 3);
    expect(a.g).toBeLessThan(200 - 27 - 12 - 3);
    const b = createGame(false);
    collect(b, obj("aguaT"));
    run(b, 3);
    expect(b.g).toBeCloseTo(100 - 3.3, 0);
  });

  it("4 segundos no vermelho custam uma vida e a glicemia volta", () => {
    const s = createGame(false);
    s.g = 45;
    s.doses.push({ rate: 0, left: 99 });
    run(s, 4.2);
    expect(s.lives).toBe(2);
    expect(s.g).toBeGreaterThan(90);
    const h = createGame(false);
    h.g = 300;
    run(h, 4.2);
    expect(h.lives).toBe(2);
    expect(h.g).toBeLessThanOrEqual(130);
  });

  it("hipoglicemia deixa mais lento; hiperglicemia cansa", () => {
    const s = createGame(false);
    s.g = 65; run(s, 0.1);
    expect(s.runSpeed / s.speed).toBeCloseTo(0.8);
    s.g = 160; run(s, 0.1);
    expect(s.runSpeed / s.speed).toBeCloseTo(0.9);
  });
});

describe("quiz", () => {
  it("baralho usa todas as 19 perguntas antes de repetir", () => {
    const d = new QuizDeck(createRng(3));
    const seen = new Set(Array.from({ length: 19 }, () => d.next().q));
    expect(seen.size).toBe(QUESTIONS.length);
  });

  it("acerto: +150, escudo 6 s e pontos ×2 por 10 s; erro: glicemia oscila", () => {
    const s = createGame(false);
    const q = QUESTIONS[0];
    expect(answerQuiz(s, q, q.a, rng)).toBe(true);
    expect([s.score, s.shield, s.mult, s.qOk, s.qTot]).toEqual([150, 6, 10, 1, 1]);
    expect(answerQuiz(s, q, !q.a, rng)).toBe(false);
    expect(s.doses.length).toBe(1);
    expect(Math.abs(s.doses[0].rate * s.doses[0].left)).toBeCloseTo(18);
  });

  it("aparece a cada 30 s e para a simulação até a resposta", () => {
    const s = createGame(false);
    s.nextRow = 1e9;
    s.nextPlate = 999;
    for (let i = 0; i < 31 * 60; i++) { s.g = 100; step(s, 1 / 60, rng); }
    expect(s.quizDue).toBe(true);
    const t = s.t;
    step(s, 1, rng);
    expect(s.t).toBe(t);
    closeQuiz(s);
    expect(s.quizT).toBe(30);
  });

  it("o escudo do quiz absorve uma batida", () => {
    const s = createGame(false);
    s.shield = 6;
    s.nextRow = 1e9;
    s.objs.push({ id: 1, kind: "obs", type: "pilha", lx: 0, z: 3, y0: 0, done: false });
    for (let i = 0; i < 30; i++) step(s, 1 / 60, rng);
    expect(s.lives).toBe(3);
    expect(s.shield).toBe(0);
  });
});

describe("chefão e Desafio do Prato", () => {
  it("chefão aparece aos 500 m, lança ultraprocessados e dá +500 sem ser atingido", () => {
    const s = createGame(false);
    s.nextRow = 1e9;
    s.nextPlate = 999;
    s.dist = 500 * 3 + 1;
    s.lane = 1; s.px = 1;
    let thrown = 0, won = false;
    for (let i = 0; i < 11 * 60; i++) {
      s.g = 100; s.quizT = 99; s.inv = 9;
      // desvia para uma faixa sem item lançado chegando
      const danger = new Set(s.objs.filter((o) => o.thrown && o.z < 4).map((o) => o.lx));
      const safe = ([-1, 0, 1] as const).find((l) => !danger.has(l))!;
      s.lane = safe; s.px = safe;
      const before = s.score;
      step(s, 1 / 60, rng);
      thrown = Math.max(thrown, s.objs.filter((o) => o.thrown).length);
      if (s.events.some((e) => e.type === "bossEnd" && e.win)) won = s.score - before >= 500;
      s.events.length = 0;
    }
    expect(thrown).toBeGreaterThan(0);
    expect(s.bossCount).toBe(1);
    expect(won).toBe(true);
  });

  it("prato equilibrado (½ vegetais, ¼ proteína, ¼ carboidrato) dá +400", () => {
    const s = createGame(false);
    s.nextRow = 1e9;
    s.nextPlate = 0;
    run(s, 0.1);
    expect(s.plate).not.toBeNull();
    for (const id of ["alface", "brocolisP", "frango", "arroz"]) collect(s, obj(id));
    const before = s.score;
    run(s, 7);
    expect(s.plate).toBeNull();
    expect(s.score - before).toBeGreaterThan(400);
  });

  it("prato com carboidrato demais não ganha bônus", () => {
    const s = createGame(false);
    s.nextRow = 1e9;
    s.nextPlate = 0;
    run(s, 0.1);
    for (const id of ["alface", "arroz", "milho", "batatadoce"]) collect(s, obj(id));
    s.events.length = 0;
    run(s, 7);
    expect(s.events.some((e) => e.type === "plateEnd" && !e.win)).toBe(true);
  });
});

describe("ambiente, conquistas e placar", () => {
  it("ciclo de 90 s: começa de dia e escurece no meio do ciclo", () => {
    expect(lightAt(10).n).toBeLessThan(0.05);
    expect(lightAt(70).n).toBeGreaterThan(0.9);
    expect(lightAt(91).n).toBeLessThan(0.05);
  });

  it("conquistas seguem os critérios do original", () => {
    const s = createGame(false);
    s.totT = 100; s.tirT = 81; s.exGot = 3; s.exMiss = 0; s.qTot = 2; s.qOk = 2;
    expect(achievements(s).every((a) => a.got)).toBe(true);
    s.exMiss = 1; s.tirT = 80; s.qOk = 1;
    expect(achievements(s).some((a) => a.got)).toBe(false);
    expect(timeInRange(s)).toBe(80);
  });

  it("placar guarda nome (até 16 letras), ordena por pontos e mantém 20", () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    for (let i = 0; i < 25; i++) {
      const s = createGame(false);
      s.score = i * 10;
      addToBoard(store, i === 24 ? "  Um nome muito comprido demais " : "", s);
    }
    const b = loadBoard(store);
    expect(b.length).toBe(20);
    expect(b[0].s).toBe(240);
    expect(b[0].n).toBe("Um nome muito co");
    expect(b[1].n).toBe("Corredor(a)");
  });
});
