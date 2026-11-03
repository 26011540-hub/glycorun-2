import { ACHIEVEMENTS } from "../content/texts";
import { timeInRange, type GameState } from "./state";

/** Conquistas do fim de corrida (critérios do original). */
export function achievements(s: GameState): { def: (typeof ACHIEVEMENTS)[number]; got: boolean }[] {
  const tir = timeInRange(s);
  const got: Record<string, boolean> = {
    eugli: tir > 80,
    atleta: s.exGot >= 3 && s.exMiss === 0,
    detetive: s.qTot >= 2 && s.qOk === s.qTot,
  };
  return ACHIEVEMENTS.map((def) => ({ def, got: got[def.id] }));
}

// ---------- Placar "Rei da Glicemia" (só neste aparelho) ----------
export interface BoardEntry { id: string; n: string; s: number; tir: number }
export interface KeyValueStore { getItem(k: string): string | null; setItem(k: string, v: string): void }

const KEY = "glycorun2-board";
export const BOARD_KEEP = 20;
export const BOARD_SHOW = 8;
export const NAME_MAX = 16;
export const DEFAULT_NAME = "Corredor(a)";

export function loadBoard(store: KeyValueStore): BoardEntry[] {
  try {
    const b = JSON.parse(store.getItem(KEY) || "[]");
    return Array.isArray(b) ? b : [];
  } catch {
    return [];
  }
}

export function saveBoard(store: KeyValueStore, b: BoardEntry[]): void {
  try { store.setItem(KEY, JSON.stringify(b)); } catch { /* armazenamento indisponível: segue sem salvar */ }
}

/** Adiciona uma corrida ao placar, ordena e mantém as 20 melhores. Devolve o id da entrada. */
export function addToBoard(store: KeyValueStore, name: string, s: GameState): string {
  const b = loadBoard(store);
  const id = `${Date.now()}-${Math.random()}`;
  const n = name.trim().slice(0, NAME_MAX) || DEFAULT_NAME;
  b.push({ id, n, s: Math.round(s.score), tir: timeInRange(s) });
  b.sort((a, c) => c.s - a.s);
  saveBoard(store, b.slice(0, BOARD_KEEP));
  return id;
}
