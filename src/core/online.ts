import { PLACAR_URL } from "../content/online";
import { cleanName, parseTop, type GlobalRow, type GlobalTop } from "../rules/global";
import type { KeyValueStore } from "../rules/scoring";

/**
 * Conversa com o placar de todos. Sem internet, mostra a última lista vista e guarda as pontuações
 * para enviar depois (até 5), na próxima vez que o jogo abrir ou a internet voltar.
 */
const LAST = "glycorun2-global";
const PENDING = "glycorun2-pending";
const WAIT_MS = 8000;

/** Endereço em uso: o do código ou, só no teste local, um passado por `?placar=`. */
function url(): string {
  const test = import.meta.env.DEV ? new URLSearchParams(location.search).get("placar") : null;
  return test || PLACAR_URL;
}
export const globalOn = (): boolean => /^https?:\/\//.test(url());

async function call(body?: GlobalRow): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), WAIT_MS);
  try {
    // texto simples: o navegador manda direto, sem a consulta prévia que o Google não responde
    const res = await fetch(url(), body
      ? { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "text/plain;charset=utf-8" }, signal: ctl.signal, redirect: "follow" }
      : { signal: ctl.signal, redirect: "follow", cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const read = (store: KeyValueStore, k: string): unknown => {
  try { return JSON.parse(store.getItem(k) || "null"); } catch { return null; }
};

export interface GlobalView { top: GlobalTop | null; fresh: boolean }

export async function loadGlobal(store: KeyValueStore): Promise<GlobalView> {
  try {
    const top = parseTop(await call());
    if (top) {
      store.setItem(LAST, JSON.stringify(top));
      return { top, fresh: true };
    }
  } catch { /* sem internet ou servidor fora: usa a última lista */ }
  return { top: parseTop(read(store, LAST)), fresh: false };
}

export type SendResult = { kind: "ok"; top: GlobalTop } | { kind: "queued" } | { kind: "rejected"; why: string };

export async function sendGlobal(store: KeyValueStore, row: GlobalRow): Promise<SendResult> {
  const clean = { n: cleanName(row.n), s: Math.round(row.s), tir: Math.round(row.tir) };
  try {
    const raw = await call(clean);
    const top = parseTop(raw);
    if (top) {
      store.setItem(LAST, JSON.stringify({ top: top.top, total: top.total }));
      return { kind: "ok", top };
    }
    const why = raw && typeof raw === "object" ? String((raw as Record<string, unknown>).erro ?? "") : "";
    if (why === "nome" || why === "pontos") return { kind: "rejected", why };
  } catch { /* sem internet: guarda para depois */ }
  const list = (read(store, PENDING) as GlobalRow[] | null) ?? [];
  list.push(clean);
  store.setItem(PENDING, JSON.stringify(list.sort((a, b) => b.s - a.s).slice(0, 5)));
  return { kind: "queued" };
}

/** Tenta mandar o que ficou guardado. */
export async function flushPending(store: KeyValueStore): Promise<void> {
  if (!globalOn()) return;
  const list = (read(store, PENDING) as GlobalRow[] | null) ?? [];
  if (!list.length) return;
  store.setItem(PENDING, "[]");
  for (let i = 0; i < list.length; i++) {
    const res = await sendGlobal(store, list[i]);
    if (res.kind === "queued") {
      // ainda sem internet: o resto fica guardado para a próxima
      const kept = (read(store, PENDING) as GlobalRow[] | null) ?? [];
      store.setItem(PENDING, JSON.stringify([...kept, ...list.slice(i + 1)].slice(0, 5)));
      return;
    }
  }
}
