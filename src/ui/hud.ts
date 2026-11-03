import { HYPER_SEVERE, HYPO_SEVERE, TARGET_HIGH, TARGET_LOW, zoneLabel, zoneOf } from "../rules/glucose";
import { lightAt, periodLabel } from "../rules/environment";
import { QUIZ_EVERY } from "../rules/constants";
import { meters, type GameState } from "../rules/state";

const $ = (id: string) => document.getElementById(id)!;

// Barra de glicemia: de 40 a 300 mg/dL
const G0 = 40, G1 = 300;
const pct = (g: number) => Math.max(0, Math.min(100, ((g - G0) / (G1 - G0)) * 100));
const ZONE_COLOR = { r: "var(--bad)", y: "#c27c00", g: "var(--ok)" } as const;

export function initGaugeBar(): void {
  const [a, b, c, d] = [HYPO_SEVERE, TARGET_LOW, TARGET_HIGH, HYPER_SEVERE].map(pct);
  $("bar").style.background =
    `linear-gradient(90deg,var(--bad) 0 ${a}%,var(--warn) ${a}% ${b}%,var(--ok) ${b}% ${c}%,var(--warn) ${c}% ${d}%,var(--bad) ${d}% 100%)`;
}

/** Atualiza o HUD. Só mexe no DOM quando um valor muda (DOM é caro no celular). */
export class Hud {
  private cache = new Map<string, string>();
  private toastLeft = 0;

  private set(id: string, key: "text" | "html" | "width" | "left" | "color", v: string): void {
    const k = id + key;
    if (this.cache.get(k) === v) return;
    this.cache.set(k, v);
    const el = $(id);
    if (key === "text") el.textContent = v;
    else if (key === "html") el.innerHTML = v;
    else if (key === "color") el.style.color = v;
    else el.style[key] = v;
  }

  reset(): void {
    this.cache.clear();
    this.toastLeft = 0;
    $("toast").classList.remove("on");
  }

  toast(text: string, sec: number): void {
    $("toast").textContent = text;
    $("toast").classList.add("on");
    this.toastLeft = sec;
  }

  tick(dt: number): void {
    if (this.toastLeft > 0 && (this.toastLeft -= dt) <= 0) $("toast").classList.remove("on");
  }

  update(s: GameState): void {
    const g = Math.round(s.g);
    const z = zoneOf(s.g);
    this.set("gval", "text", String(g));
    this.set("marker", "left", pct(s.g).toFixed(1) + "%");
    this.set("zone", "text", zoneLabel(s.g));
    this.set("zone", "color", ZONE_COLOR[z]);
    this.set("lives", "text", "♥".repeat(Math.max(0, s.lives)) + "♡".repeat(Math.max(0, 3 - s.lives)));
    this.set("score", "text", String(Math.round(s.score)));
    this.set("dist", "text", `${Math.round(meters(s))} m`);
    this.set("day", "text", `Dia ${s.day} · ${periodLabel(lightAt(s.t))}`);
    this.set("cond", "width", s.cond.toFixed(0) + "%");
    const q = Math.max(0, s.quizT);
    this.set("qt", "text", String(Math.ceil(q)));
    const ring = $("qring");
    ring.style.setProperty("--p", (q / QUIZ_EVERY).toFixed(2));
    ring.classList.toggle("soon", q <= 5);

    let chips = "";
    const chip = (ic: string, label: string, col: string, sec?: number) =>
      (chips += `<span class="chip" style="background:${col}" title="${label}">${ic}${sec ? ` ${Math.ceil(sec)}s` : ""}</span>`);
    if (s.magnet > 0) chip("🧲", "Ímã", "#d6457f", s.magnet);
    if (s.turbo > 0) chip("👟", "Pulo duplo", "var(--gold)", s.turbo);
    else if (s.boost > 0) chip("⚡", "Sensibilidade ↑", "var(--ex)", s.boost);
    if (s.insShield) chip("🛡️", "Escudo de Insulina", "#8a5cd6");
    if (s.shield > 0) chip("✅", "Escudo do quiz", "var(--ok)", s.shield);
    if (s.mult > 0) chip("×2", "Pontos extra", "#c27c00", s.mult);
    if (s.rain > 0.5) chip("🌧️", "Chuva", "#5b6b80");
    this.set("chips", "html", chips);

    $("plate").hidden = !s.plate;
    if (s.plate) {
      this.set("pVeg", "text", `½ VEG · ${s.plate.veg}`);
      this.set("pProt", "text", `¼ PROT · ${s.plate.prot}`);
      this.set("pCarb", "text", `¼ CARB · ${s.plate.carb}`);
    }
  }
}

/**
 * Sintomas na tela (como no original): hipo = visão sem cor; hiper = visão embaçada e amarelada.
 * Na etapa 5 isso passa para dentro do 3D (mais leve no celular).
 */
export function setSymptoms(canvas: HTMLCanvasElement, tint: HTMLElement, g: number | null): void {
  let filter = "";
  let blur = 0;
  if (g != null && g < TARGET_LOW) filter = `grayscale(${Math.min(0.9, 0.35 + (TARGET_LOW - g) / 30).toFixed(2)})`;
  else if (g != null && g > TARGET_HIGH) {
    blur = Math.min(1, (g - TARGET_HIGH) / 110 + 0.25);
    filter = `blur(${(blur * 3).toFixed(1)}px) sepia(${(0.25 * blur).toFixed(2)})`;
  }
  if (canvas.style.filter !== filter) canvas.style.filter = filter;
  const op = (blur * 0.9).toFixed(2);
  if (tint.style.opacity !== op) tint.style.opacity = op;
}
