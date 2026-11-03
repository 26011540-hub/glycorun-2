import { defineConfig } from "vitest/config";

export default defineConfig({
  // Caminhos relativos: o mesmo build funciona no GitHub Pages (em /nome-do-repo/) e localmente.
  base: "./",
  build: { target: "es2020", chunkSizeWarningLimit: 900 },
  test: { include: ["tests/**/*.test.ts"] },
});
