import "@fontsource/fredoka/latin-600.css";
import "@fontsource/fredoka/latin-700.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-800.css";
import "./ui/style.css";
import { createGame, timeInRange, toast, type GameEvent, type GameState } from "./rules/state";
import { act, step } from "./rules/step";
import { createRng } from "./rules/rng";
import { answerQuiz, closeQuiz, QuizDeck } from "./rules/quiz";
import { addToBoard, saveBoard, NAME_MAX } from "./rules/scoring";
import { badName, cleanName } from "./rules/global";
import { flushPending, globalOn, loadGlobal, sendGlobal } from "./core/online";
import { lightAt } from "./rules/environment";
import { TARGET_HIGH } from "./rules/glucose";
import type { Question } from "./content/quiz";
import { BRUCE_BANNER, GLOBAL, INVITE, MSG, SKINS, type SkinId } from "./content/texts";
import { hasInvite } from "./rules/invite";
import { World3D, type ViewMode } from "./render/world";
import { biomeAt, BIOME_NAMES, type Biome } from "./render/scenery";
import { bindInput } from "./input/input";
import { audio, type Sfx } from "./audio/audio";
import { Hud, initGaugeBar, type Tone } from "./ui/hud";
import { AutoQuality, QUALITY_LABEL, type QualityChoice } from "./core/quality";
import { banner, buildStaticScreens, refreshSkins, renderBoard, renderGlobal, showAnswer, showGameOver, showOnly, showQuestion, type Screen } from "./ui/screens";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const TOUCH = matchMedia("(pointer: coarse)").matches;

// Armazenamento local seguro (pode falhar em janela anônima)
const store = {
  getItem: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
};

let mode: ViewMode = "menu";
let rng = createRng();
const deck = new QuizDeck(createRng());
let state: GameState = createGame(TOUCH, rng);
let question: Question | null = null;
let answered = false;
let lastEntry: string | null = null;
let saved = false;
let countT = 0;
let biome: Biome = "bairro";
// Visual exclusivo: o link da apresentação (?convite=drbruce) desbloqueia e já veste
const invited = hasInvite(location.search);
if (invited) store.setItem("glycorun2-vip", "1");
const vipOn = () => store.getItem("glycorun2-vip") === "1";
let skin = (store.getItem("glycorun2-skin") as SkinId) || "corredor";
if (invited) { skin = "medico"; store.setItem("glycorun2-skin", skin); }
if (!SKINS.some((s) => s.id === skin) || (skin === "medico" && !vipOn())) skin = "corredor";
let vibrate = store.getItem("glycorun2-vibe") !== "0";
audio.muted = store.getItem("glycorun2-mute") === "1";

const app = $("app");
const canvas = $<HTMLCanvasElement>("game");

const world = new World3D(canvas);
world.setSkin(skin);
world.dogs.onBark = () => audio.play("bark");
world.bruce.onBark = () => audio.play("barkBig");
world.bruce.onArrive = () => banner(BRUCE_BANNER);
world.onArch = () => {
  banner("UEPG<small>Universidade Estadual de Ponta Grossa</small>");
  audio.play("win");
  buzz(40);
};
const hud = new Hud();
initGaugeBar();
buildStaticScreens(TOUCH, skin, (s) => { skin = s; store.setItem("glycorun2-skin", s); world.setSkin(s); sfx("click"); }, vipOn);
if (invited) {
  setTimeout(() => banner(INVITE.banner), 600);
  refreshSkins(true);
}

new ResizeObserver(() => { world.resize(canvas.clientWidth, canvas.clientHeight); drawnStill = false; }).observe(canvas);
world.resize(canvas.clientWidth, canvas.clientHeight);

// ---------- Qualidade gráfica (automática ou escolhida) ----------
const CHOICES: QualityChoice[] = ["auto", "alta", "media", "baixa"];
const savedQ = store.getItem("glycorun2-quality") as QualityChoice;
const autoQ = new AutoQuality(CHOICES.includes(savedQ) ? savedQ : "auto", TOUCH);
world.setQuality(autoQ.level);
function paintQuality() {
  const t = `Qualidade: ${QUALITY_LABEL[autoQ.choice]}${autoQ.choice === "auto" ? ` (${QUALITY_LABEL[autoQ.level]})` : ""}`;
  document.querySelectorAll<HTMLElement>("[data-quality]").forEach((b) => (b.textContent = "⚙️ " + t));
}
document.querySelectorAll<HTMLElement>("[data-quality]").forEach((b) => (b.onclick = () => {
  const next = CHOICES[(CHOICES.indexOf(autoQ.choice) + 1) % CHOICES.length];
  autoQ.set(next, TOUCH);
  store.setItem("glycorun2-quality", next);
  world.setQuality(autoQ.level);
  drawnStill = false; // redesenha na pausa
  paintQuality();
  sfx("click");
}));
paintQuality();

function setMode(m: ViewMode) {
  mode = m;
  app.dataset.mode = m;
}
const sfx = (n: Sfx) => audio.play(n);
const buzz = (ms: number) => { if (vibrate && TOUCH && navigator.vibrate) try { navigator.vibrate(ms); } catch { /* sem vibração */ } };

// ---------- Configurações (som e vibração) ----------
function paintSettings() {
  const label = audio.muted ? "Som desligado" : "Som ligado";
  $("soundBtn").textContent = audio.muted ? "🔇" : "🔊";
  $("soundBtn").setAttribute("aria-label", label);
  $("tSound").setAttribute("aria-checked", String(!audio.muted));
  $("tSound").textContent = audio.muted ? "🔇 Som" : "🔊 Som";
  $("tVibe").setAttribute("aria-checked", String(vibrate));
}
function toggleSound() {
  audio.unlock();
  audio.setMuted(!audio.muted);
  store.setItem("glycorun2-mute", audio.muted ? "1" : "0");
  paintSettings();
  sfx("click");
}
$("soundBtn").onclick = toggleSound;
$("tSound").onclick = toggleSound;
$("tVibe").onclick = () => { vibrate = !vibrate; store.setItem("glycorun2-vibe", vibrate ? "1" : "0"); paintSettings(); buzz(30); };
paintSettings();

// ---------- Fluxo do jogo ----------
function start() {
  void flushPending(store); // manda pontuações que ficaram sem internet
  audio.unlock();
  sfx("click");
  rng = createRng();
  state = createGame(TOUCH, rng);
  saved = false;
  biome = "bairro";
  showOnly(null);
  $("hud").hidden = false;
  hud.reset();
  hud.update(state);
  setMode("count");
  countT = 0;
}
function go() {
  setMode("run");
  toast(state, MSG.start, 3);
  const params = new URLSearchParams(location.search);
  if (params.has("arco")) world.placeArch(state.dist); // atalhos para a apresentação
  if (params.has("bruce")) world.startBruce(state);
  audio.tempo = 108;
  audio.boss = false;
  audio.setDuck(1);
  audio.startMusic();
}
function toMenu() {
  setMode("menu");
  audio.stopMusic();
  audio.setRain(0);
  $("hud").hidden = true;
  world.setSymptoms(null);
  showOnly("menu");
}
function togglePause() {
  if (mode === "run") { setMode("pause"); showOnly("pause"); audio.setDuck(0); audio.setRain(0); }
  else if (mode === "pause") { setMode("run"); showOnly(null); state.inv = Math.max(state.inv, 1); audio.setDuck(1); }
}
function answer(saidTrue: boolean) {
  if (mode !== "quiz" || answered || !question) return;
  answered = true;
  const ok = answerQuiz(state, question, saidTrue, rng);
  showAnswer(question, ok);
  sfx(ok ? "right" : "wrong");
  buzz(ok ? 25 : 80);
  setTimeout(() => $("cont").focus(), 50);
}
function continueRun() {
  if (mode !== "quiz" || !answered) return;
  closeQuiz(state);
  setMode("run");
  showOnly(null);
  audio.setDuck(1);
}
function finish() {
  setMode("over");
  audio.stopMusic();
  audio.setRain(0);
  sfx("over");
  world.setSymptoms(null);
  setTimeout(() => {
    showGameOver(state, MSG.overSuffix);
    $<HTMLInputElement>("pname").value = store.getItem("glycorun2-name") || "";
    $<HTMLButtonElement>("saveBtn").textContent = "Salvar";
    $<HTMLButtonElement>("saveBtn").disabled = false;
    lastEntry = null;
    $("saveNote").hidden = true;
    renderBoard(store, $("board1"), null);
    if (state.totT > 0 && state.tirT / state.totT > 0.8) sfx("win");
  }, 1100);
}

const open = (id: Screen) => () => { sfx("click"); showOnly(id); };
$("play").onclick = start;
$("again").onclick = start;
$("toMenu").onclick = toMenu;
$("quit").onclick = toMenu;
$("resume").onclick = togglePause;
$("pauseBtn").onclick = togglePause;
$("bm").onclick = () => answer(false);
$("bv").onclick = () => answer(true);
$("cont").onclick = continueRun;
$("howBtn").onclick = open("how");
$("srcBtn").onclick = open("sources");
// ---------- Placar: aba "Todos" (pódio online) e aba "Este aparelho" ----------
let boardLoad = 0;
function boardTab(all: boolean): void {
  $("tabAll").classList.toggle("on", all);
  $("tabHere").classList.toggle("on", !all);
  $("tabAll").setAttribute("aria-selected", String(all));
  $("tabHere").setAttribute("aria-selected", String(!all));
  $("paneAll").hidden = !all;
  $("paneHere").hidden = all;
  $("clearBoard").hidden = all;
  if (!all) { renderBoard(store, $("board2"), null); return; }
  if (!globalOn()) { renderGlobal(null, GLOBAL.off, null); return; }
  const me = store.getItem("glycorun2-name");
  renderGlobal(null, GLOBAL.loading, me);
  const ticket = ++boardLoad;
  void loadGlobal(store).then(({ top, fresh }) => {
    if (ticket !== boardLoad) return; // a pessoa já trocou de aba
    const note = !top ? GLOBAL.offlineNone : fresh ? GLOBAL.total(top.total) : GLOBAL.offline;
    renderGlobal(top, note, me);
  });
}
$("tabAll").onclick = () => { sfx("click"); resetClear(); boardTab(true); };
$("tabHere").onclick = () => { sfx("click"); boardTab(false); };
$("boardBtn").onclick = () => { open("boardPanel")(); boardTab(globalOn()); };
document.querySelectorAll<HTMLElement>("[data-back]").forEach((b) => (b.onclick = () => { resetClear(); open("menu")(); }));
let clearArmed = false;
const resetClear = () => { clearArmed = false; $("clearBoard").textContent = "Zerar placar"; };
$("clearBoard").onclick = () => {
  if (!clearArmed) { clearArmed = true; $("clearBoard").textContent = "Toque de novo para confirmar"; return; }
  saveBoard(store, []);
  renderBoard(store, $("board2"), null);
  resetClear();
};
$("saveForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (saved) return;
  const name = cleanName($<HTMLInputElement>("pname").value.slice(0, NAME_MAX));
  const note = $("saveNote");
  const say = (text: string, cls = "") => { note.textContent = text; note.className = "gnote " + cls; note.hidden = false; };
  if (badName(name)) { say(GLOBAL.badName, "no"); sfx("wrong"); return; }
  store.setItem("glycorun2-name", name);
  lastEntry = addToBoard(store, name, state);
  saved = true;
  sfx("right");
  $<HTMLButtonElement>("saveBtn").textContent = "Salvo!";
  $<HTMLButtonElement>("saveBtn").disabled = true;
  renderBoard(store, $("board1"), lastEntry);
  if (!globalOn()) return;
  if (!name) { say(GLOBAL.needName); return; }
  say(GLOBAL.loading);
  void sendGlobal(store, { n: name, s: Math.round(state.score), tir: timeInRange(state) }).then((r) => {
    if (r.kind === "ok") say(GLOBAL.sent(r.top.pos), "ok");
    else if (r.kind === "queued") say(GLOBAL.queued);
    else say(r.why === "nome" ? GLOBAL.badName : GLOBAL.rejected, "no");
  });
});
document.addEventListener("visibilitychange", () => { if (document.hidden && mode === "run") togglePause(); });
window.addEventListener("online", () => void flushPending(store));
window.addEventListener("keydown", (e) => {
  if (mode !== "quiz" || e.target instanceof HTMLInputElement) return;
  if (e.key === "m" || e.key === "M") answer(false);
  if (e.key === "v" || e.key === "V") answer(true);
});
bindInput(canvas, (a) => { if (mode === "run") act(state, a); }, togglePause);

// ---------- Reações aos acontecimentos (som, vibração, letreiros, tom dos avisos) ----------
const COLLECT: Record<string, [Sfx, Tone, number]> = {
  good: ["good", "good", 0], water: ["water", "info", 0], ex: ["ex", "good", 15], med: ["med", "info", 0],
  bad: ["bad", "bad", 35], fix: ["fix", "good", 20], insulin: ["insulin", "good", 20], plate: ["plate", "good", 0], power: ["power", "power", 20],
};
function onEvents(events: GameEvent[]) {
  let tone: Tone = "info";
  for (const e of events) {
    switch (e.type) {
      case "collect": { const [s, t, v] = COLLECT[e.effect]; sfx(s); tone = t; if (v) buzz(v); break; }
      case "hit": sfx("hit"); buzz(120); tone = "bad"; break;
      case "shieldBlock": sfx("shield"); tone = "good"; break;
      case "glucoseLife": sfx("life"); buzz(220); tone = "bad"; break;
      case "jump": sfx(e.double ? "doubleJump" : "jump"); break;
      case "land": sfx("land"); break;
      case "slide": sfx("slide"); break;
      case "lane": sfx("lane"); break;
      case "bossStart": sfx("boss"); buzz(60); audio.boss = true; banner("Chefão!<small>Desvie dos ultraprocessados</small>"); tone = "warn"; break;
      case "bossEnd": sfx(e.win ? "win" : "lose"); audio.boss = false; if (e.win) banner("+500!<small>Chefão vencido</small>"); tone = e.win ? "good" : "info"; break;
      case "plateStart": sfx("quiz"); banner("Desafio do Prato<small>½ vegetais · ¼ proteína · ¼ carboidrato</small>"); tone = "warn"; break;
      case "plateEnd": sfx(e.win ? "win" : "lose"); if (e.win) banner("+400!<small>Prato equilibrado</small>"); tone = e.win ? "good" : "warn"; break;
      case "day": sfx("day"); banner(`Dia ${e.day}`); break;
      case "rain": if (e.on) tone = "info"; break;
      case "quiz":
        if (mode === "run") {
          setMode("quiz");
          answered = false;
          question = deck.next();
          showQuestion(question);
          sfx("quiz");
          audio.setDuck(0.35);
          setTimeout(() => $("bv").focus(), 50);
        }
        break;
      case "gameOver": finish(); break;
      case "toast": break;
    }
  }
  // avisos de glicemia ficam com o tom de alerta
  for (const e of events) {
    if (e.type !== "toast") continue;
    const t = e.text === MSG.warnLow || e.text === MSG.warnHigh ? "warn" : e.text === MSG.severeLow || e.text === MSG.severeHigh ? "bad" : tone;
    if (t === "warn") sfx("warn");
    hud.toast(e.text, e.sec, t);
  }
}

// contador de FPS opcional: abra o jogo com ?fps
const fpsEl = $("fps");
const showFps = new URLSearchParams(location.search).has("fps");
fpsEl.hidden = !showFps;
let fpsAcc = 0, fpsFrames = 0, hudAcc = 0, drawnStill = false;

let last = performance.now();
let time = 0;
let smooth = 1 / 60; // tempo do quadro suavizado: tira a tremedeira do relógio do navegador
let warmed = false;
let fontsReady = false;
document.fonts.ready.then(() => { fontsReady = true; });

function frame(now: number) {
  const raw = (now - last) / 1000;
  last = now;
  if (mode === "run") {
    const q = autoQ.sample(raw);
    if (q) { world.setQuality(q); paintQuality(); }
  }
  // prepara tudo enquanto a pessoa ainda está no menu
  if (!warmed && fontsReady && mode === "menu") { warmed = true; world.prewarm(); }
  smooth += (Math.min(0.05, raw) - smooth) * 0.25;
  advance(smooth);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function advance(dt: number) {
  time += dt;
  if (mode === "count") {
    // contagem 3, 2, 1, Vai!
    const before = Math.floor(countT / 0.7);
    countT += dt;
    const now = Math.floor(countT / 0.7);
    if (countT === dt || now !== before) {
      const n = 3 - now;
      if (n > 0) { banner(String(n), true); sfx("tick"); }
      else { banner("Vai!", true); sfx("go"); buzz(30); go(); }
    }
  }
  if (mode === "run") {
    step(state, dt, rng);
    const b = biomeAt(state.dist);
    if (b !== biome) { biome = b; banner(BIOME_NAMES[b]); }
    audio.tempo = 108 + Math.min(24, (state.speed - 18) * 1.1);
    audio.setRain(state.rain);
  }
  // no quiz e na pausa nada se move: não redesenhar poupa bateria e evita o celular esquentar
  const still = mode === "quiz" || mode === "pause";
  if (!still || !drawnStill) world.update(state, state.events, still ? 0 : dt, time, mode);
  drawnStill = still;
  onEvents(state.events);
  state.events.length = 0;
  hud.tick(mode === "run" ? dt : 0);
  if (mode === "run" && (hudAcc += dt) >= 0.08) {
    hudAcc = 0;
    hud.update(state);
    world.setSymptoms(state.g);
    audio.setMood(lightAt(state.t).n, state.g > TARGET_HIGH);
  }

  if (showFps) {
    fpsAcc += dt; fpsFrames++;
    if (fpsAcc >= 0.5) { fpsEl.textContent = `${Math.round(fpsFrames / fpsAcc)} fps · ${world.drawCalls} desenhos`; fpsAcc = 0; fpsFrames = 0; }
  }
}

// Só no modo de desenvolvimento: permite inspecionar o estado e avançar quadros durante os testes.
if (import.meta.env.DEV) {
  Object.assign(window, {
    __glyco: {
      get state() { return state; },
      get mode() { return mode; },
      get drawCalls() { return world.drawCalls; },
      world,
      audio,
      advance(sec: number) { for (let i = 0; i < sec * 60; i++) advance(1 / 60); },
      /** Desenha a cena num tamanho de tela (ex.: 390×844) e salva em .debug/<name>.jpg. */
      async shot(name: string, w = 390, h = 844) {
        world.resize(w, h);
        advance(1 / 60);
        const url = canvas.toDataURL("image/jpeg", 0.85);
        world.resize(canvas.clientWidth, canvas.clientHeight);
        await fetch(`/__debug/shot?name=${encodeURIComponent(name)}`, { method: "POST", body: url });
      },
    },
  });
}

// Versão publicada: guarda o jogo no aparelho para abrir sem internet.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => { /* sem modo offline */ });
    // já na primeira visita, pede para guardar todos os arquivos que a página usou
    navigator.serviceWorker.ready.then((reg) => {
      const urls = performance.getEntriesByType("resource").map((e) => e.name).filter((u) => u.startsWith(location.origin));
      reg.active?.postMessage({ cache: urls });
    });
  });
}
