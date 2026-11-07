// Placar de todos os jogadores: regras puras (nome, filtro de palavrões, leitura da resposta do servidor).
// O servidor (servidor/placar.gs) repete o filtro e as checagens: o jogo não confia só no aparelho.

import { NAME_MAX } from "./scoring";

export interface GlobalRow { n: string; s: number; tir: number }
export interface GlobalTop { top: GlobalRow[]; total: number; pos?: number }
export const GLOBAL_SHOW = 20;
export const SCORE_MAX = 9_999_999;

const LEET: Record<string, string> = { "4": "a", "@": "a", "3": "e", "1": "i", "!": "i", "0": "o", "5": "s", $: "s", "7": "t" };
const plain = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const squeeze = (t: string) => t.replace(/(.)\1+/g, "$1"); // "porrrra" vira "pora"
const words = (t: string) => plain(t).replace(/[4@3105$7!]/g, (c) => LEET[c]).replace(/[^a-z]+/g, " ").trim().split(" ").filter(Boolean).map(squeeze);

// Palavras curtas só contam sozinhas; as do meio contam no começo da palavra; as longas, em qualquer lugar.
const WHOLE = ["cu", "cus", "rola", "pau", "corno", "fdp", "vsf", "pqp", "tnc", "krl", "crl", "bct", "pnc", "tmnc"].map(squeeze);
const START = ["puta", "puto", "porra", "merda", "bosta", "foda", "foder", "fodid", "fuder", "fudid", "viad", "otari", "babaca", "cacete", "bicha", "retardad", "nazi", "hitler", "vadia", "piranha", "safad", "idiota", "imbecil", "burro"].map(squeeze);
const ANY = ["caralh", "buceta", "boceta", "piroca", "arrombad", "punheta", "xoxota", "xereca", "filhadaputa", "vagabund", "cuzao", "kct"].map(squeeze);

/** Verdadeiro se o apelido tem palavrão ou ofensa (também escrito com números ou letras repetidas). */
export function badName(name: string): boolean {
  const w = words(name), joined = squeeze(w.join(""));
  return w.some((x) => WHOLE.includes(x) || START.some((p) => x.startsWith(p))) || ANY.some((p) => joined.includes(p));
}

/** Apelido limpo: sem sinais estranhos, sem espaços sobrando e com até 16 letras. */
export function cleanName(name: string): string {
  return name.replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
}

/** Chave do jogador: o mesmo apelido com ou sem acento e maiúsculas conta como a mesma pessoa. */
export const nameKey = (name: string) => plain(cleanName(name));

export function validRow(r: unknown): r is GlobalRow {
  if (!r || typeof r !== "object") return false;
  const o = r as Record<string, unknown>;
  return typeof o.n === "string" && o.n.length > 0 && o.n.length <= NAME_MAX
    && Number.isInteger(o.s) && (o.s as number) >= 0 && (o.s as number) <= SCORE_MAX
    && typeof o.tir === "number" && o.tir >= 0 && o.tir <= 100;
}

/** Lê a resposta do servidor; qualquer coisa fora do formato é ignorada. */
export function parseTop(x: unknown): GlobalTop | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (!Array.isArray(o.top) || typeof o.total !== "number") return null;
  const top = o.top.filter(validRow).slice(0, GLOBAL_SHOW).map((r) => ({ n: cleanName(r.n), s: r.s, tir: Math.round(r.tir) }));
  top.sort((a, b) => b.s - a.s);
  const pos = typeof o.pos === "number" && o.pos > 0 ? Math.floor(o.pos) : undefined;
  return { top, total: Math.max(top.length, Math.floor(o.total)), pos };
}
