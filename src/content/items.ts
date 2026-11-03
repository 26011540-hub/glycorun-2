// Itens do caminho, copiados do GlycoRun original (emoji, tipo, nome e pesos de sorteio).
// k: good = comida de verdade · water = água · med = medicação · ex = atividade física · bad = ultraprocessado
//    veg/prot/carb = Desafio do Prato · pw = power-up

export type ItemKind = "good" | "water" | "med" | "ex" | "bad" | "veg" | "prot" | "carb" | "pw";

export interface ItemDef {
  e: string;
  k: ItemKind;
  n: string;
  fiber?: boolean; // o Ímã de Fibras puxa
  fast?: boolean; // carboidrato rápido: corrige hipoglicemia
  mild?: boolean; // pico menor
}

export const ITEMS = {
  maca: { e: "🍎", k: "good", n: "Maçã", fiber: true },
  brocolis: { e: "🥦", k: "good", n: "Brócolis", fiber: true },
  aveia: { e: "🥣", k: "good", n: "Aveia", fiber: true },
  salada: { e: "🥗", k: "good", n: "Prato equilibrado", fiber: true },
  cenoura: { e: "🥕", k: "good", n: "Cenoura", fiber: true },
  agua: { e: "💧", k: "water", n: "Água" },
  remedio: { e: "💊", k: "med", n: "Medicação" },
  bike: { e: "🚲", k: "ex", n: "Bicicleta" },
  bola: { e: "🏀", k: "ex", n: "Esporte" },
  refri: { e: "🥤", k: "bad", n: "Refrigerante", fast: true },
  bala: { e: "🍬", k: "bad", n: "Balas", fast: true },
  suco: { e: "🧃", k: "bad", n: "Suco de caixinha", fast: true, mild: true },
  donut: { e: "🍩", k: "bad", n: "Doce" },
  burger: { e: "🍔", k: "bad", n: "Fast food" },
  batata: { e: "🍟", k: "bad", n: "Fritura" },
  // Desafio do Prato
  alface: { e: "🥬", k: "veg", n: "Vegetais" },
  brocolisP: { e: "🥦", k: "veg", n: "Vegetais" },
  saladaP: { e: "🥗", k: "veg", n: "Vegetais" },
  frango: { e: "🍗", k: "prot", n: "Proteína" },
  ovo: { e: "🥚", k: "prot", n: "Proteína" },
  peixe: { e: "🐟", k: "prot", n: "Proteína" },
  arroz: { e: "🍚", k: "carb", n: "Carboidrato" },
  batatadoce: { e: "🍠", k: "carb", n: "Carboidrato" },
  milho: { e: "🌽", k: "carb", n: "Carboidrato" },
  // power-ups
  ima: { e: "🧲", k: "pw", n: "Ímã de Fibras" },
  tenis: { e: "👟", k: "pw", n: "Tênis do Boost" },
  escudo: { e: "🛡️", k: "pw", n: "Escudo de Insulina" },
  aguaT: { e: "🚰", k: "pw", n: "Água Turbo" },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;
export const item = (id: string): ItemDef => (ITEMS as Record<string, ItemDef>)[id];

/** Pesos de sorteio dos itens comuns. */
export const POOL: readonly [ItemId, number][] = [
  ["maca", 9], ["brocolis", 7], ["aveia", 6], ["salada", 6], ["cenoura", 5], ["agua", 8], ["remedio", 3], ["bike", 4], ["bola", 3],
  ["refri", 8], ["bala", 6], ["suco", 3], ["donut", 6], ["burger", 6], ["batata", 5],
];

export const POWERUPS: readonly ItemId[] = ["ima", "tenis", "escudo", "aguaT"];
export const PLATE_LANES: readonly (readonly ItemId[])[] = [
  ["alface", "brocolisP", "saladaP"], // faixa da esquerda: vegetais
  ["frango", "ovo", "peixe"], // meio: proteína
  ["arroz", "batatadoce", "milho"], // direita: carboidrato
];
export const BOSS_THROWS: readonly ItemId[] = ["refri", "bala", "donut", "burger"];

/** Legenda do menu (textos do original). */
export const LEGEND = [
  { e: "🍎", t: "Comida de verdade e fibras", d: "Sobem a glicose devagar e melhoram o condicionamento." },
  { e: "🥤", t: "Ultraprocessados", d: "Pico glicêmico rápido. Bip bip!" },
  { e: "🚲", t: "Atividade física", d: "Baixa a glicose e aumenta a sensibilidade à insulina." },
  { e: "💧", t: "Água", d: "Hidratação. Não muda a glicemia." },
  { e: "💊", t: "Medicação", d: "Baixa a glicose. Com glicemia baixa, risco de hipoglicemia." },
  { e: "🛋️", t: "Sedentarismo", d: "Sofá: pule. Tela: abaixe. Pilha de telas: desvie ou pulo duplo." },
];
export const POWER_LEGEND = [
  { e: "🧲", t: "Ímã de Fibras", d: "Puxa frutas, vegetais e aveia por 10 s." },
  { e: "👟", t: "Tênis do Boost", d: "Pulo duplo alto e glicemia normaliza 2× mais rápido." },
  { e: "🛡️", t: "Escudo de Insulina", d: "Segura o pico do próximo ultraprocessado." },
  { e: "🚰", t: "Água Turbo", d: "Na glicemia alta, hidrata e ajuda o rim a eliminar parte do excesso." },
];
