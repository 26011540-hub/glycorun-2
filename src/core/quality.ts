/**
 * Qualidade gráfica. "Automática" começa em alta (ou média no celular) e baixa um nível
 * sempre que o jogo fica abaixo de ~48 quadros por segundo por alguns segundos.
 * Nunca sobe sozinha, para não ficar oscilando.
 */
export type Quality = "alta" | "media" | "baixa";
export type QualityChoice = Quality | "auto";

export interface QualitySettings {
  pixelRatio: number; // nitidez (pixels por ponto da tela)
  msaa: number; // suavização de bordas
  rain: number; // gotas de chuva
  particles: number; // fração das partículas
  viewFar: number; // até onde o cenário é desenhado
}

export const QUALITY: Record<Quality, QualitySettings> = {
  alta: { pixelRatio: 2, msaa: 4, rain: 500, particles: 1, viewFar: 150 },
  media: { pixelRatio: 1.5, msaa: 2, rain: 300, particles: 0.7, viewFar: 135 },
  baixa: { pixelRatio: 1, msaa: 0, rain: 140, particles: 0.4, viewFar: 110 },
};
export const QUALITY_LABEL: Record<QualityChoice, string> = { auto: "Automática", alta: "Alta", media: "Média", baixa: "Baixa" };
const ORDER: Quality[] = ["alta", "media", "baixa"];

export class AutoQuality {
  level: Quality;
  private acc = 0;
  private frames = 0;
  private slow = 0;
  private warmup = 3; // ignora os primeiros segundos (carregamento)

  constructor(public choice: QualityChoice, touch: boolean) {
    this.level = choice === "auto" ? (touch ? "media" : "alta") : choice;
  }

  set(choice: QualityChoice, touch: boolean): void {
    this.choice = choice;
    this.level = choice === "auto" ? (touch ? "media" : "alta") : choice;
    this.acc = this.frames = this.slow = 0;
    this.warmup = 3;
  }

  /** Registra um quadro. Devolve o novo nível quando ele muda. */
  sample(dt: number): Quality | null {
    if (this.choice !== "auto" || dt <= 0) return null;
    if (this.warmup > 0) { this.warmup -= dt; return null; }
    this.acc += dt;
    this.frames++;
    if (this.acc < 2) return null;
    const fps = this.frames / this.acc;
    this.acc = this.frames = 0;
    this.slow = fps < 48 ? this.slow + 1 : 0;
    if (this.slow >= 2) {
      this.slow = 0;
      const i = ORDER.indexOf(this.level);
      if (i < ORDER.length - 1) {
        this.level = ORDER[i + 1];
        this.warmup = 1.5;
        return this.level;
      }
    }
    return null;
  }
}
