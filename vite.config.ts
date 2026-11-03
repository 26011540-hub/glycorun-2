import { mkdirSync, writeFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vitest/config";

/**
 * Só no modo de desenvolvimento: recebe uma captura da cena 3D (enviada por __glyco.shot no navegador)
 * e salva em .debug/, para conferir o visual em tamanho de celular. Não vai para a versão publicada.
 */
function debugShots(): Plugin {
  return {
    name: "debug-shots",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__debug/shot", (req, res) => {
        if (req.method !== "POST") return void res.end();
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          const q = new URL(req.url ?? "", "http://x").searchParams;
          const name = (q.get("name") || "shot").replace(/[^\w-]/g, "");
          // ?icon=1 grava o ícone do jogo em public/icons (PNG); o resto vai para .debug (JPG)
          const dir = q.get("icon") ? "public/icons" : ".debug";
          mkdirSync(dir, { recursive: true });
          writeFileSync(`${dir}/${name}.${q.get("icon") ? "png" : "jpg"}`, Buffer.from(body.replace(/^data:image\/\w+;base64,/, ""), "base64"));
          res.end("ok");
        });
      });
    },
  };
}

export default defineConfig({
  // Caminhos relativos: o mesmo build funciona no GitHub Pages (em /nome-do-repo/) e localmente.
  base: "./",
  plugins: [debugShots()],
  build: { target: "es2020", chunkSizeWarningLimit: 900 },
  test: { include: ["tests/**/*.test.ts"] },
});
