import { LEGEND, POWER_LEGEND } from "../content/items";
import type { Question } from "../content/quiz";
import { BOARD_INTRO, INTRO, SKINS, SOURCES, SOURCES_INTRO, type SkinId } from "../content/texts";
import { achievements, BOARD_SHOW, loadBoard, type KeyValueStore } from "../rules/scoring";
import { meters, timeInRange, type GameState } from "../rules/state";

const $ = (id: string) => document.getElementById(id)!;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export const OVERLAYS = ["menu", "quiz", "over", "boardPanel", "pause", "sources"] as const;
export type Overlay = (typeof OVERLAYS)[number];
export function showOnly(id: Overlay | null): void {
  for (const o of OVERLAYS) $(o).hidden = o !== id;
}

const SKIN_ICON: Record<SkinId, string> = { corredor: "🏃", fone: "🎧", mochila: "🎒", acs: "🩺" };

/** Monta os textos fixos do menu e das telas a partir de src/content. */
export function buildStaticScreens(touch: boolean, skin: SkinId, onSkin: (s: SkinId) => void): void {
  $("intro").textContent = INTRO;
  for (const [id, list, pw] of [["legend", LEGEND, false], ["powerLegend", POWER_LEGEND, true]] as const) {
    const box = $(id);
    for (const l of list) {
      const d = el("div", pw ? "leg pw" : "leg");
      const t = el("div");
      t.append(el("b", undefined, l.t), document.createTextNode(l.d));
      d.append(el("span", "em", l.e), t);
      box.append(d);
    }
  }
  const skins = $("skins");
  const paint = (cur: SkinId) => skins.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.skin === cur)));
  for (const s of SKINS) {
    const b = el("button", "skin");
    b.dataset.skin = s.id;
    b.innerHTML = `<div style="font-size:24px">${SKIN_ICON[s.id]}</div>`;
    b.append(s.label);
    b.onclick = () => { onSkin(s.id); paint(s.id); };
    skins.append(b);
  }
  paint(skin);
  $("keys").textContent = touch
    ? "Deslize na pista: para os lados troca de faixa, para cima pula, para baixo abaixa."
    : "← → trocar faixa · ↑ pular · ↓ abaixar · P pausar. No celular: deslize na pista.";
  $("srcIntro").textContent = SOURCES_INTRO;
  for (const s of SOURCES) {
    const li = el("li", undefined, s.text);
    if (s.link) {
      const a = el("a", undefined, " diretriz.diabetes.org.br");
      a.setAttribute("href", s.link);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
      li.append(s.text.endsWith(":") ? "" : " —", a);
    }
    $("srcList").append(li);
  }
  $("boardIntro").textContent = BOARD_INTRO;
}

export function renderBoard(store: KeyValueStore, target: HTMLElement, highlight: string | null): void {
  target.innerHTML = "";
  const b = loadBoard(store);
  if (!b.length) {
    target.append(el("p", "empty", "Ninguém no placar ainda. Jogue e salve seu nome!"));
    return;
  }
  for (const r of b.slice(0, BOARD_SHOW)) {
    const li = el("li", r.id === highlight ? "me" : undefined);
    li.append(el("span", "nm", r.n), el("span", "tir", `${r.tir}% no alvo`), el("span", "pts", String(r.s)));
    target.append(li);
  }
}

export function showQuestion(q: Question): void {
  $("qq").textContent = q.q;
  $("qbtns").hidden = false;
  $("qfb").hidden = true;
  $("qcont").hidden = true;
  showOnly("quiz");
}

export function showAnswer(q: Question, ok: boolean): void {
  const fb = $("qfb");
  fb.innerHTML = "";
  const st = el("strong", undefined, (ok ? "Acertou! " : "Quase! ") + (q.a ? "É verdade." : "É mito."));
  st.style.color = ok ? "var(--ok)" : "var(--bad)";
  fb.append(st, el("div", undefined, q.e), el("span", "src", "Fonte: " + q.s));
  $("qbtns").hidden = true;
  fb.hidden = false;
  $("qcont").hidden = false;
}

export function showGameOver(s: GameState, suffix: string): void {
  const tir = timeInRange(s);
  $("overMsg").textContent = s.overReason + suffix;
  $("sScore").textContent = String(Math.round(s.score));
  $("sTir").textContent = tir + "%";
  $("sDist").textContent = `${Math.round(meters(s))} m · ${s.day} ${s.day > 1 ? "dias" : "dia"}`;
  $("sQuiz").textContent = `${s.qOk}/${s.qTot}`;
  const box = $("badges");
  box.innerHTML = "";
  for (const { def, got } of achievements(s)) {
    const d = el("div", "badge " + (got ? "got" : "lock"));
    const t = el("div");
    t.append(el("b", undefined, def.t), document.createTextNode(got ? "Conquistada! " + def.d : def.d));
    d.append(el("span", "ic", def.ic), t);
    box.append(d);
  }
  showOnly("over");
}
