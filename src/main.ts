import "./ui/style.css";
import { createGame, type GameState } from "./rules/state";
import { act, step } from "./rules/step";
import { createRng } from "./rules/rng";
import { UNITS_PER_METER } from "./rules/constants";
import { World3D } from "./render/world";
import { bindInput } from "./input/input";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const TOUCH = matchMedia("(pointer: coarse)").matches;
const show = (id: string, on: boolean) => { $(id).hidden = !on; };

type Mode = "menu" | "run" | "pause" | "over";
let mode: Mode = "menu";
let rng = createRng();
let state: GameState = createGame(TOUCH);

const canvas = $<HTMLCanvasElement>("game");
const world = new World3D(canvas);

function resize() {
  world.resize(canvas.clientWidth, canvas.clientHeight);
}
new ResizeObserver(resize).observe(canvas);
resize();

function start() {
  rng = createRng();
  state = createGame(TOUCH);
  mode = "run";
  for (const id of ["menu", "over", "pause"]) show(id, false);
  show("hud", true);
}
function pause() {
  if (mode === "run") { mode = "pause"; show("pause", true); }
  else if (mode === "pause") { mode = "run"; show("pause", false); }
}

$("play").onclick = start;
$("again").onclick = start;
$("resume").onclick = pause;
$("pauseBtn").onclick = pause;
document.addEventListener("visibilitychange", () => { if (document.hidden && mode === "run") pause(); });
bindInput(canvas, (a) => { if (mode === "run") act(state, a); }, pause);

// HUD: só reescreve o texto quando muda
let lastHud = "";
function hud() {
  const m = Math.round(state.dist / UNITS_PER_METER);
  const text = `${state.lives}|${Math.round(state.score)}|${m}`;
  if (text === lastHud) return;
  lastHud = text;
  $("lives").textContent = "♥".repeat(Math.max(0, state.lives)) + "♡".repeat(Math.max(0, 3 - state.lives));
  $("score").textContent = String(Math.round(state.score));
  $("dist").textContent = `${m} m`;
}

// contador de FPS opcional: abra o jogo com ?fps
const fpsEl = $("fps");
const showFps = new URLSearchParams(location.search).has("fps");
fpsEl.hidden = !showFps;
let fpsAcc = 0, fpsFrames = 0;

let last = performance.now();
let time = 0;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  if (mode === "run") {
    step(state, dt, rng);
    if (state.over) {
      mode = "over";
      $("overStats").textContent = `${Math.round(state.score)} pontos · ${Math.round(state.dist / UNITS_PER_METER)} m`;
      setTimeout(() => show("over", true), 600);
    }
    hud();
  }
  world.update(state, state.events, mode === "run" || mode === "over" ? dt : 0, time);
  state.events.length = 0;

  if (showFps) {
    fpsAcc += dt; fpsFrames++;
    if (fpsAcc >= 0.5) { fpsEl.textContent = `${Math.round(fpsFrames / fpsAcc)} fps`; fpsAcc = 0; fpsFrames = 0; }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Só no modo de desenvolvimento: permite inspecionar o estado durante os testes.
if (import.meta.env.DEV) Object.assign(window, { __glyco: { get state() { return state; }, get mode() { return mode; } } });
