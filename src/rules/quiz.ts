import { QUESTIONS, type Question } from "../content/quiz";
import { MSG } from "../content/texts";
import * as K from "./constants";
import { dose } from "./glucose";
import type { Rng } from "./rng";
import { toast, type GameState } from "./state";

/** Baralho de perguntas: embaralha e só repete depois de usar todas. */
export class QuizDeck {
  private order: number[] = [];
  private i = 0;
  constructor(private rng: Rng) {}
  next(): Question {
    if (this.i >= this.order.length) {
      this.order = QUESTIONS.map((_, k) => k);
      for (let k = this.order.length - 1; k > 0; k--) {
        const j = Math.floor(this.rng() * (k + 1));
        [this.order[k], this.order[j]] = [this.order[j], this.order[k]];
      }
      this.i = 0;
    }
    return QUESTIONS[this.order[this.i++]];
  }
}

/** Resposta do jogador. Devolve se acertou. */
export function answerQuiz(s: GameState, q: Question, saidTrue: boolean, rng: Rng): boolean {
  const ok = saidTrue === q.a;
  s.qTot++;
  if (ok) {
    s.qOk++;
    s.shield = 6;
    s.mult = 10;
    s.score += 150;
  } else {
    s.doses.push(dose((rng() < 0.5 ? -1 : 1) * 18, 1.5));
  }
  return ok;
}

/** Volta a correr depois do quiz. */
export function closeQuiz(s: GameState): void {
  s.quizDue = false;
  s.quizT = K.QUIZ_EVERY;
  s.inv = Math.max(s.inv, 1.2);
  s.events.push({ type: "quizEnd", ok: s.mult > 0 });
  toast(s, s.mult > 0 ? MSG.quizOk : MSG.quizNo, 2.4);
}
