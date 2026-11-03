import type { Action } from "../rules/state";

const SWIPE_PX = 18; // distância mínima do dedo para contar como deslize

/**
 * Converte teclado e deslizes na tela em ações.
 * O deslize responde durante o movimento, sem esperar tirar o dedo; um deslize longo vale uma ação por direção.
 */
export function bindInput(surface: HTMLElement, onAction: (a: Action) => void, onPause: () => void): void {
  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement) return;
    const map: Record<string, Action> = {
      ArrowLeft: "L", a: "L", A: "L",
      ArrowRight: "R", d: "R", D: "R",
      ArrowUp: "U", w: "U", W: "U", " ": "U",
      ArrowDown: "D", s: "D", S: "D",
    };
    const a = map[e.key];
    if (a) {
      e.preventDefault();
      if (!e.repeat) onAction(a);
    } else if (e.key === "p" || e.key === "P" || e.key === "Escape") {
      onPause();
    }
  });

  let start: { x: number; y: number; dir: Action | null; id: number } | null = null;
  surface.addEventListener("pointerdown", (e) => {
    start = { x: e.clientX, y: e.clientY, dir: null, id: e.pointerId };
    try { surface.setPointerCapture(e.pointerId); } catch { /* sem captura, segue normal */ }
  });
  surface.addEventListener("pointermove", (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    const dir: Action = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "L" : "R") : dy < 0 ? "U" : "D";
    start.x = e.clientX;
    start.y = e.clientY;
    if (dir !== start.dir) {
      start.dir = dir;
      onAction(dir);
    }
  });
  for (const ev of ["pointerup", "pointercancel"] as const) surface.addEventListener(ev, () => { start = null; });
  surface.addEventListener("contextmenu", (e) => e.preventDefault());
}
