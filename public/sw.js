// Service worker do GlycoRun 2: guarda o jogo no aparelho para funcionar sem internet
// depois de aberto uma vez (útil na UBS). Troque VERSION a cada publicação importante.
const VERSION = "glycorun2-v2";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    // página: tenta a internet primeiro (pega atualizações); sem internet, usa a cópia guardada
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put("./index.html", copy)); return res; })
        .catch(() => caches.match("./index.html")),
    );
    return;
  }
  // arquivos do jogo (nomes mudam a cada versão): usa a cópia guardada; se não tiver, baixa e guarda
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});

// A página avisa quais arquivos carregou na primeira visita, para guardar tudo de uma vez.
self.addEventListener("message", (e) => {
  const urls = (e.data && e.data.cache) || [];
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(urls.map((u) => c.match(u).then((hit) => hit || c.add(u).catch(() => {}))))));
});
