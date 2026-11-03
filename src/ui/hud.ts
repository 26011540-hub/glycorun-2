import { HYPER_SEVERE, HYPO_SEVERE, TARGET_HIGH, TARGET_LOW, zoneLabel, zoneOf } from "../rules/glucose";
import { QUIZ_EVERY } from "../rules/constants";
import { meters, type GameState } from "../rules/state";

const $ = (id: string) => document.getElementById(id)!;

// Barra de glicemia: de 40 a 300 mg/dL
const G0 = 40, G1 = 300;
const pct = (g: number) => Math.max(0, Math.min(100, ((g - G0) / (G1 - G0)) * 100));
const ZONE_COLOR = { r: "var(--bad)", y: "#b87700", g: "var(--ok2)" } as const;

export type Tone = "info" | "good" | "bad" | "warn" | "power";

export function initGaugeBar(): void {
  const [a, b, c, d] = [HYPO_SEVERE, TARGET_LOW, TARGET_HIGH, HYPER_SEVERE].map(pct);
  $("bar").style.background =
    `linear-gradient(90deg,var(--bad) 0 ${a}%,var(--warn) ${a}% ${b}%,var(--ok) ${b}% ${c}%,var(--warn) ${c}% ${d}%,var(--bad) ${d}% 100%)`;
}

/** Atualiza o HUD. Só mexe na página quando um valor muda (isso é caro no celular). */
export class Hud {
  private cache = new Map<string, string>();
  private toastLeft = 0;
  private lastZone = "";

  private set(id: string, key: "text" | "html" | "width" | "left" | "color" | "class", v: string): void {
    const k = id + key;
    if (this.cache.get(k) === v) return;
    this.cache.set(k, v);
    const el = $(id);
    if (key === "text") el.textContent = v;
    else if (key === "html") el.innerHTML = v;
    else if (key === "color") el.style.color = v;
    else if (key === "class") el.className = v;
    else el.style[key] = v;
  }

  reset(): void {
    this.cache.clear();
    this.toastLeft = 0;
    this.lastZone = "";
    $("toast").className = "toast";
    $("danger").className = "";
  }

  toast(text: string, sec: number, tone: Tone = "info"): void {
    const t = $("toast");
    t.textContent = text;
    t.className = "toast";
    void t.offsetWidth;
    t.className = `toast on ${tone}`;
    this.toastLeft = sec;
  }

  tick(dt: number): void {
    if (this.toastLeft > 0 && (this.toastLeft -= dt) <= 0) $("toast").classList.remove("on");
  }

  update(s: GameState): void {
    const z = zoneOf(s.g);
    this.set("gval", "text", String(Math.round(s.g)));
    this.set("marker", "left", pct(s.g).toFixed(1) + "%");
    this.set("zone", "text", zoneLabel(s.g));
    this.set("zone", "color", ZONE_COLOR[z]);
    this.set("gcard", "class", "gcard" + (s.g < TARGET_LOW ? " low" : s.g > TARGET_HIGH ? " high" : "") + (this.lastZone && this.lastZone !== z ? " pulse" : ""));
    this.lastZone = z;
    this.set("danger", "class", z === "r" ? "on" : "");
    const lost = Math.max(0, 3 - s.lives);
    this.set("lives", "html", "♥".repeat(Math.max(0, Math.min(3, s.lives))) + (lost ? `<span class="lost">${"♥".repeat(lost)}</span>` : ""));
    this.set("score", "text", String(Math.round(s.score)));
    this.set("dist", "text", `${Math.round(meters(s))} m · Dia ${s.day}`);
    this.set("cond", "width", s.cond.toFixed(0) + "%");
    const q = Math.max(0, s.quizT);
    this.set("qt", "text", String(Math.ceil(q)));
    const ring = $("qring");
    ring.style.setProperty("--p", (q / QUIZ_EVERY).toFixed(2));
    this.set("qring", "class", q <= 5 ? "ring soon" : "ring");

    let chips = "";
    const chip = (ic: string, label: string, col: string, sec?: number) =>
      (chips += `<span class="chip" style="background:${col}" title="${label}" aria-label="${label}">${ic}${sec ? ` ${Math.ceil(sec)}s` : ""}</span>`);
    if (s.magnet > 0) chip("🧲", "Ímã de Fibras", "#d6457f", s.magnet);
    if (s.turbo > 0) chip("👟", "Pulo duplo", "var(--gold)", s.turbo);
    else if (s.boost > 0) chip("⚡", "Sensibilidade à insulina", "var(--ex)", s.boost);
    if (s.insShield) chip("🛡️", "Escudo de Insulina", "var(--med)");
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
