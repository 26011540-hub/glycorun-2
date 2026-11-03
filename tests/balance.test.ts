import { describe, expect, it } from "vitest";
import { createGame, timeInRange, type GameState } from "../src/rules/state";
import { act, step } from "../src/rules/step";
import { answerQuiz, closeQuiz, QuizDeck } from "../src/rules/quiz";
import { createRng, type Rng } from "../src/rules/rng";
import { item } from "../src/content/items";

// Simulação de equilíbrio: um jogador "cuidadoso" deve conseguir ficar bastante tempo na faixa 70–140.

function value(s: GameState, type: string, careful: boolean): number {
  const it = item(type);
  if (!careful) return it.k === "pw" ? 1 : 0.5; // pega o que vier
  const g = s.g;
  switch (it.k) {
    case "good": return g < 120 ? 2 : -1;
    case "bad": return g < 70 && it.fast ? 6 : -4;
    case "ex": return g > 95 ? 2 : -1;
    case "med": return g > 115 ? 2 : -3;
    case "water": return 0.3;
    case "pw": return 3;
    case "veg": return 2;
    default: return 1;
  }
}

function play(seed: number, seconds: number, careful: boolean) {
  const rng: Rng = createRng(seed);
  const s = createGame(true, rng);
  const deck = new QuizDeck(rng);
  let decide = 0;
  for (let i = 0; i < seconds * 60 && !s.over; i++) {
    if (s.quizDue) {
      const q = deck.next();
      answerQuiz(s, q, rng() < 0.7 ? q.a : !q.a, rng); // acerta 70%
      closeQuiz(s);
    }
    // obstáculo na faixa atual: pula, abaixa ou troca
    const obs = s.objs.find((o) => o.kind === "obs" && !o.done && o.z > 0 && o.z < 4.5 && Math.abs(o.lx - s.lane) < 0.5);
    if (obs && s.y === 0 && s.slide === 0) {
      if (obs.type === "sofa" && obs.z < 3.5) act(s, "U");
      else if (obs.type === "tela" && obs.z < 2.5) act(s, "D");
      else if (obs.type === "pilha") act(s, s.lane === 1 ? "L" : "R");
    }
    if ((decide -= 1 / 60) <= 0) {
      decide = 0.2;
      let best: number = s.lane, bestV = -Infinity;
      for (const l of [-1, 0, 1]) {
        let v = l === s.lane ? 0.2 : 0;
        for (const o of s.objs) {
          if (o.done || o.z < 1.5 || o.z > 14 || Math.abs(o.lx - l) > 0.5) continue;
          v += o.kind === "obs" ? (o.type === "pilha" ? -8 : -1) : value(s, o.type, careful) / (1 + o.z * 0.1);
        }
        if (v > bestV) { bestV = v; best = l; }
      }
      if (best < s.lane) act(s, "L");
      else if (best > s.lane) act(s, "R");
    }
    step(s, 1 / 60, rng);
    s.events.length = 0;
  }
  return { tir: timeInRange(s), lives: s.lives, over: s.over, t: Math.round(s.t), g: Math.round(s.g) };
}

describe("equilíbrio com faixa-alvo 70–140", () => {
  it("jogador cuidadoso fica a maior parte do tempo no verde; descuidado bem menos", () => {
    const careful = [1, 2, 3, 4, 5].map((seed) => play(seed, 180, true));
    const careless = [1, 2, 3, 4, 5].map((seed) => play(seed, 180, false));
    const avg = (r: { tir: number }[]) => r.reduce((a, b) => a + b.tir, 0) / r.length;
    console.log("cuidadoso", careful, "média", avg(careful));
    console.log("descuidado", careless, "média", avg(careless));
    expect(avg(careful)).toBeGreaterThan(60);
    expect(avg(careful)).toBeGreaterThan(avg(careless) + 10);
  });
});
