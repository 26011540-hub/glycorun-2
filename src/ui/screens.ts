import { LEGEND, POWER_LEGEND } from "../content/items";
import type { Question } from "../content/quiz";
import { BOARD_INTRO, GLOBAL, INTRO, INVITE, SKINS, SOURCES, SOURCES_INTRO, type SkinId } from "../content/texts";
import { nameKey, type GlobalTop } from "../rules/global";
import { achievements, BOARD_SHOW, loadBoard, type KeyValueStore } from "../rules/scoring";
import { meters, timeInRange, type GameState } from "../rules/state";

const $ = (id: string) => document.getElementById(id)!;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export const SCREENS = ["menu", "how", "quiz", "over", "boardPanel", "pause", "sources"] as const;
export type Screen = (typeof SCREENS)[number];
export function showOnly(id: Screen | null): void {
  for (const o of SCREENS) $(o).hidden = o !== id;
}

const SKIN_ICON: Record<SkinId, string> = { corredor: "🏃", fone: "🎧", mochila: "🎒", acs: "🩺", medico: "🥼" };

/** Monta os textos fixos das telas a partir de src/content. */
export function buildStaticScreens(touch: boolean, skin: SkinId, onSkin: (s: SkinId) => void, unlocked: () => boolean): void {
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
  const paint = (cur: SkinId) => skins.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.skin === cur)));
  for (const s of SKINS) {
    const special = "exclusive" in s;
    const b = el("button", special ? "skin vip" : "skin");
    b.dataset.skin = s.id;
    b.setAttribute("role", "radio");
    b.append(el("span", "ic", SKIN_ICON[s.id]), s.label);
    if (special) b.append(el("span", "tag", "exclusivo"));
    b.onclick = () => {
      if (special && !unlocked()) { banner(`🔒 Exclusivo<small>${INVITE.locked}</small>`); return; }
      onSkin(s.id);
      paint(s.id);
    };
    skins.append(b);
  }
  paint(skin);
  refreshSkins(unlocked());
  $("keys").textContent = touch
    ? "Deslize o dedo na pista: para os lados troca de faixa, para cima pula, para baixo abaixa."
    : "Setas ou W A S D: ← → troca de faixa, ↑ pula, ↓ abaixa. P pausa. No celular: deslize o dedo na pista.";
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
  $("globalIntro").textContent = GLOBAL.intro;
}

/** Mostra o cadeado no visual exclusivo enquanto ele não foi desbloqueado. */
export function refreshSkins(unlocked: boolean): void {
  $("skins").querySelectorAll<HTMLElement>(".skin.vip").forEach((b) => b.classList.toggle("lock", !unlocked));
}

/** Aba "Todos": pódio com os 3 primeiros e a lista do 4º em diante. */
export function renderGlobal(top: GlobalTop | null, note: string, me: string | null): void {
  const podium = $("podium"), rest = $("boardAll"), mine = me ? nameKey(me) : null;
  podium.innerHTML = "";
  rest.innerHTML = "";
  $("globalNote").textContent = note;
  if (!top) return;
  if (!top.top.length) { $("globalNote").textContent = GLOBAL.empty; return; }
  for (const place of [2, 1, 3]) {
    const r = top.top[place - 1];
    const spot = el("div", `spot p${place}${r ? "" : " empty"}${r && nameKey(r.n) === mine ? " me" : ""}`);
    if (place === 1) spot.append(el("div", "crown", "👑"));
    else spot.append(el("div", "medal", place === 2 ? "🥈" : "🥉"));
    spot.append(el("div", "who", r ? r.n : "—"), el("div", "pts", r ? String(r.s) : ""), el("div", "tir", r ? `${r.tir}% no alvo` : ""), el("div", "step", String(place)));
    podium.append(spot);
  }
  for (const r of top.top.slice(3)) {
    const li = el("li", nameKey(r.n) === mine ? "me" : undefined);
    li.append(el("span", "nm", r.n), el("span", "tir", `${r.tir}% no alvo`), el("span", "pts", String(r.s)));
    rest.append(li);
  }
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
  fb.className = "fb " + (ok ? "ok" : "no");
  const st = el("strong", undefined, (ok ? "✅ Acertou! " : "Quase! ") + (q.a ? "É verdade." : "É mito."));
  st.style.color = ok ? "var(--ok2)" : "var(--bad)";
  fb.append(st, el("div", undefined, q.e), el("span", "src", "Fonte: " + q.s));
  $("qbtns").hidden = true;
  fb.hidden = false;
  $("qcont").hidden = false;
}

/** Número que "conta" até o valor final. */
function countUp(node: HTMLElement, to: number, suffix = "", ms = 900): void {
  const t0 = performance.now();
  const tick = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    node.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))) + suffix;
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function showGameOver(s: GameState, suffix: string): void {
  const tir = timeInRange(s);
  $("overTitle").textContent = tir > 80 ? "Que controle! 🏅" : "Fim de corrida";
  $("overMsg").textContent = s.overReason + suffix;
  countUp($("sScore"), Math.round(s.score));
  countUp($("sTir"), tir, "%");
  $("sDist").textContent = `${Math.round(meters(s))} m · ${s.day} ${s.day > 1 ? "dias" : "dia"}`;
  $("sQuiz").textContent = `${s.qOk}/${s.qTot}`;
  const box = $("badges");
  box.innerHTML = "";
  achievements(s).forEach(({ def, got }, i) => {
    const d = el("div", "badge " + (got ? "got" : "lock"));
    d.style.animationDelay = `${0.3 + i * 0.12}s`;
    const t = el("div");
    t.append(el("b", undefined, def.t), document.createTextNode(got ? "Conquistada! " + def.d : def.d));
    d.append(el("span", "ic", def.ic), t);
    box.append(d);
  });
  showOnly("over");
}

/** Letreiro grande e rápido no céu (contagem, chefão, novo bairro). */
export function banner(html: string, count = false): void {
  const b = $("banner");
  b.className = "banner";
  b.innerHTML = html;
  void b.offsetWidth; // reinicia a animação
  b.className = "banner show" + (count ? " count" : "");
}
