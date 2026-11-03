// Glicemia: zonas e efeitos graduais.

export const HYPO_SEVERE = 54; // abaixo: hipoglicemia nível 2 (vermelho)
export const TARGET_LOW = 70;
export const TARGET_HIGH = 140; // faixa-alvo decidida pelo autor (o original usava 180)
export const HYPER_SEVERE = 250; // acima: vermelho
export const G_MIN = 30;
export const G_MAX = 320;
export const G_START = 100;

export type Zone = "r" | "y" | "g";

export function zoneOf(g: number): Zone {
  if (g < HYPO_SEVERE) return "r";
  if (g < TARGET_LOW) return "y";
  if (g <= TARGET_HIGH) return "g";
  if (g <= HYPER_SEVERE) return "y";
  return "r";
}

/** Rótulo da zona para o HUD. */
export function zoneLabel(g: number): string {
  if (g < HYPO_SEVERE) return "Hipoglicemia nível 2: corrija já!";
  if (g < TARGET_LOW) return "Hipoglicemia: 15 g de carboidrato rápido";
  if (g > HYPER_SEVERE) return "Hiperglicemia grave";
  if (g > TARGET_HIGH) return "Hiperglicemia: visão embaçada";
  return "Na faixa-alvo · pontos ×2";
}

/** Um alimento ou exercício não muda a glicemia de uma vez: o efeito é espalhado no tempo. */
export interface Dose {
  rate: number; // mg/dL por segundo
  left: number; // segundos restantes
}

export function dose(total: number, duration: number): Dose {
  return { rate: total / duration, left: duration };
}
