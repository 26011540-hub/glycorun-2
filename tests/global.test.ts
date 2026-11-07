import { describe, expect, it } from "vitest";
import { badName, cleanName, nameKey, parseTop } from "../src/rules/global";

describe("placar de todos", () => {
  it("bloqueia palavrões, mesmo disfarçados", () => {
    for (const n of ["porra", "P0RRA", "porrrrra", "caralho", "car4lho", "Filho da puta", "fdp", "vai tnc", "viadinho", "buceta123", "Puta Que Pariu"]) {
      expect(badName(n), n).toBe(true);
    }
  });

  it("deixa nomes comuns passarem", () => {
    for (const n of ["Ana", "João Pedro", "Computador", "Disputa", "Cuca", "Pauline", "Rolando", "Maria Eduarda", "Turma 3B", "Dr. Bruce", "Corredor(a)"]) {
      expect(badName(n), n).toBe(false);
    }
  });

  it("limpa o apelido e junta grafias parecidas", () => {
    expect(cleanName("  Ana   <b>Clara</b>  ")).toBe("Ana bClara/b");
    expect(cleanName("Um nome muito comprido demais").length).toBe(16);
    expect(nameKey("JOÃO")).toBe(nameKey("joao"));
  });

  it("lê a resposta do servidor e descarta o que estiver errado", () => {
    const t = parseTop({ top: [{ n: "Ana", s: 50, tir: 80 }, { n: "Bia", s: 900, tir: 65.4 }, { n: "", s: 10, tir: 1 }, { n: "X", s: -5, tir: 1 }, "lixo"], total: 7, pos: 2 });
    expect(t).toEqual({ top: [{ n: "Bia", s: 900, tir: 65 }, { n: "Ana", s: 50, tir: 80 }], total: 7, pos: 2 });
    expect(parseTop({ erro: "nome" })).toBeNull();
    expect(parseTop(null)).toBeNull();
  });
});
