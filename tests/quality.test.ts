import { describe, expect, it } from "vitest";
import { AutoQuality } from "../src/core/quality";

const run = (q: AutoQuality, fps: number, sec: number) => {
  let changed = null;
  for (let t = 0; t < sec; t += 1 / fps) changed = q.sample(1 / fps) ?? changed;
  return changed;
};

describe("qualidade automática", () => {
  it("começa em alta no computador e média no celular", () => {
    expect(new AutoQuality("auto", false).level).toBe("alta");
    expect(new AutoQuality("auto", true).level).toBe("media");
  });

  it("a 60 fps não muda", () => {
    const q = new AutoQuality("auto", false);
    run(q, 60, 20);
    expect(q.level).toBe("alta");
  });

  it("a 30 fps desce um nível de cada vez até baixa", () => {
    const q = new AutoQuality("auto", false);
    run(q, 30, 9);
    expect(q.level).toBe("media");
    run(q, 30, 12);
    expect(q.level).toBe("baixa");
  });

  it("escolha manual nunca muda sozinha", () => {
    const q = new AutoQuality("alta", true);
    run(q, 20, 30);
    expect(q.level).toBe("alta");
  });
});
