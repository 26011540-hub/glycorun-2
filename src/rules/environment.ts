import { DAY_CYCLE } from "./constants";

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface Light {
  n: number; // 0 = dia, 1 = noite
  d: number; // 0–1 entardecer/amanhecer
  c: number; // posição no ciclo (0–1)
}

/** Luz do ciclo de dia e noite (mesma curva do original). */
export function lightAt(t: number): Light {
  const c = (t % DAY_CYCLE) / DAY_CYCLE;
  const n = smooth(0.55, 0.66, c) * (1 - smooth(0.88, 0.98, c));
  const d = Math.max(Math.exp(-(((c - 0.57) / 0.045) ** 2)), Math.exp(-(((c - 0.93) / 0.035) ** 2)));
  return { n, d, c };
}

export const periodLabel = (l: Light) => (l.n > 0.5 ? "noite" : l.d > 0.4 ? "entardecer" : "dia");
