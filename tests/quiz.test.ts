import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QUESTIONS } from "../src/content/quiz";
import { ITEMS, POOL } from "../src/content/items";
import { SOURCES } from "../src/content/texts";

// Garante que o conteúdo protegido é idêntico ao do GlycoRun original.
const html = readFileSync(new URL("../GlycoRun.html", import.meta.url), "utf8");

function originalLiteral(name: string): unknown {
  const start = html.indexOf(`const ${name} = `);
  const startAlt = start >= 0 ? start : html.indexOf(`const ${name}=`);
  expect(startAlt).toBeGreaterThan(0);
  const from = html.indexOf("=", startAlt) + 1;
  const end = html.indexOf(";\n", from);
  return new Function(`return (${html.slice(from, end)});`)();
}

describe("conteúdo protegido", () => {
  it("as 19 perguntas, respostas, explicações e fontes são idênticas ao original", () => {
    const orig = originalLiteral("QUESTIONS") as { q: string; a: boolean; e: string; s: string }[];
    expect(orig.length).toBe(19);
    expect(QUESTIONS.map((x) => ({ ...x }))).toEqual(orig);
  });

  it("itens: mesmos emojis, tipos e nomes do original", () => {
    const orig = originalLiteral("ITEMS") as Record<string, { e: string; k: string; n: string }>;
    expect(Object.keys(ITEMS).sort()).toEqual(Object.keys(orig).sort());
    for (const [id, o] of Object.entries(orig)) {
      const mine = (ITEMS as Record<string, { e: string; k: string; n: string }>)[id];
      expect([mine.e, mine.k, mine.n]).toEqual([o.e, o.k, o.n]);
    }
  });

  it("pesos de sorteio iguais ao original", () => {
    const orig = originalLiteral("POOL");
    expect(POOL.map((p) => [...p])).toEqual(orig);
  });

  it("fontes da tela 'Fontes (SBD)' aparecem no original", () => {
    const plain = html.replace(/<[^>]+>/g, "");
    for (const src of SOURCES) {
      expect(plain).toContain(src.text);
      if (src.link) expect(html).toContain(src.link);
    }
  });
});
