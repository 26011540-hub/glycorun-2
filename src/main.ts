import "./ui/style.css";
import { createGame, toast, type GameState } from "./rules/state";
import { act, step } from "./rules/step";
import { createRng } from "./rules/rng";
import { answerQuiz, closeQuiz, QuizDeck } from "./rules/quiz";
import { addToBoard, saveBoard, NAME_MAX } from "./rules/scoring";
import type { Question } from "./content/quiz";
import { MSG, SKINS, type SkinId } from "./content/texts";
import { World3D } from "./render/world";
import { bindInput } from "./input/input";
import { Hud, initGaugeBar, setSymptoms } from "./ui/hud";
import { buildStaticScreens, renderBoard, showAnswer, showGameOver, showOnly, showQuestion } from "./ui/screens";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const TOUCH = matchMedia("(pointer: coarse)").matches;

// Armazenamento local seguro (pode falhar em janela anônima)
const store = {
  getItem: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
};

type Mode = "menu" | "run" | "pause" | "quiz" | "over";
let mode: Mode = "menu";
let rng = createRng();
const deck = new QuizDeck(createRng());
let state: GameState = createGame(TOUCH, rng);
let question: Question | null = null;
let answered = false;
let lastEntry: string | null = null;
let saved = false;
let skin = (store.getItem("glycorun2-skin") as SkinId) || "corredor";
if (!SKINS.some((s) => s.id === skin)) skin = "corredor";

const canvas = $<HTMLCanvasElement>("game");
const tint = $("tint");
const world = new World3D(canvas);
world.setSkin(skin);
const hud = new Hud();
initGaugeBar();
buildStaticScreens(TOUCH, skin, (s) => { skin = s; store.setItem("glycorun2-skin", s); world.setSkin(s); });

new ResizeObserver(() => world.resize(canvas.clientWidth, canvas.clientHeight)).observe(canvas);
world.resize(canvas.clientWidth, canvas.clientHeight);

function start() {
  rng = createRng();
  state = createGame(TOUCH, rng);
  mode = "run";
  saved = false;
  showOnly(null);
  $("hud").hidden = false;
  hud.reset();
  toast(state, MSG.start, 3);
}
function toMenu() {
  mode = "menu";
  $("hud").hidden = true;
  setSymptoms(canvas, tint, null);
  showOnly("menu");
}
function togglePause() {
  if (mode === "run") { mode = "pause"; showOnly("pause"); }
  else if (mode === "pause") { mode = "run"; showOnly(null); state.inv = Math.max(state.inv, 1); }
}
function answer(saidTrue: boolean) {
  if (mode !== "quiz" || answered || !question) return;
  answered = true;
  showAnswer(question, answerQuiz(state, question, saidTrue, rng));
  setTimeout(() => $("cont").focus(), 50);
}
function continueRun() {
  if (mode !== "quiz" || !answered) return;
  closeQuiz(state);
  mode = "run";
  showOnly(null);
}

$("play").onclick = start;
$("again").onclick = start;
$("toMenu").onclick = toMenu;
$("quit").onclick = toMenu;
$("resume").onclick = togglePause;
$("pauseBtn").onclick = togglePause;
$("bm").onclick = () => answer(false);
$("bv").onclick = () => answer(true);
$("cont").onclick = continueRun;
$("srcBtn").onclick = () => showOnly("sources");
$("srcBack").onclick = () => showOnly("menu");
$("boardBtn").onclick = () => { renderBoard(store, $("board2"), null); showOnly("boardPanel"); };
let clearArmed = false;
const resetClear = () => { clearArmed = false; $("clearBoard").textContent = "Zerar placar"; };
$("boardBack").onclick = () => { resetClear(); showOnly("menu"); };
$("clearBoard").onclick = () => {
  if (!clearArmed) { clearArmed = true; $("clearBoard").textContent = "Toque de novo para confirmar"; return; }
  saveBoard(store, []);
  renderBoard(store, $("board2"), null);
  resetClear();
};
$("saveForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (saved) return;
  const name = $<HTMLInputElement>("pname").value.slice(0, NAME_MAX);
  store.setItem("glycorun2-name", name);
  lastEntry = addToBoard(store, name, state);
  saved = true;
  $<HTMLButtonElement>("saveBtn").textContent = "Salvo!";
  $<HTMLButtonElement>("saveBtn").disabled = true;
  renderBoard(store, $("board1"), lastEntry);
});
document.addEventListener("visibilitychange", () => { if (document.hidden && mode === "run") togglePause(); });
window.addEventListener("keydown", (e) => {
  if (mode !== "quiz" || e.target instanceof HTMLInputElement) return;
  if (e.key === "m" || e.key === "M") answer(false);
  if (e.key === "v" || e.key === "V") answer(true);
});
bindInput(canvas, (a) => { if (mode === "run") act(state, a); }, togglePause);

function finish() {
  mode = "over";
  setSymptoms(canvas, tint, null);
  setTimeout(() => {
    showGameOver(state, MSG.overSuffix);
    $<HTMLInputElement>("pname").value = store.getItem("glycorun2-name") || "";
    $<HTMLButtonElement>("saveBtn").textContent = "Salvar no placar";
    $<HTMLButtonElement>("saveBtn").disabled = false;
    lastEntry = null;
    renderBoard(store, $("board1"), null);
  }, 700);
}

// contador de FPS opcional: abra o jogo com ?fps
const fpsEl = $("fps");
const showFps = new URLSearchParams(location.search).has("fps");
fpsEl.hidden = !showFps;
let fpsAcc = 0, fpsFrames = 0, hudAcc = 0;

let last = performance.now();
let time = 0;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  advance(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function advance(dt: number) {
  time += dt;
  if (mode === "run") step(state, dt, rng);
  world.update(state, state.events, mode === "run" || mode === "over" ? dt : 0, time);
  for (const e of state.events) {
    if (e.type === "toast") hud.toast(e.text, e.sec);
    else if (e.type === "quiz" && mode === "run") {
      mode = "quiz";
      answered = false;
      question = deck.next();
      showQuestion(question);
      setTimeout(() => $("bv").focus(), 50);
    } else if (e.type === "gameOver") finish();
  }
  state.events.length = 0;
  hud.tick(mode === "run" ? dt : 0);
  if (mode === "run" && (hudAcc += dt) >= 0.08) {
    hudAcc = 0;
    hud.update(state);
    setSymptoms(canvas, tint, state.g);
  }

  if (showFps) {
    fpsAcc += dt; fpsFrames++;
    if (fpsAcc >= 0.5) { fpsEl.textContent = `${Math.round(fpsFrames / fpsAcc)} fps`; fpsAcc = 0; fpsFrames = 0; }
  }
}

// Só no modo de desenvolvimento: permite inspecionar o estado e avançar quadros durante os testes.
if (import.meta.env.DEV) {
  Object.assign(window, {
    __glyco: {
      get state() { return state; },
      get mode() { return mode; },
      advance(sec: number) { for (let i = 0; i < sec * 60; i++) advance(1 / 60); },
    },
  });
}
