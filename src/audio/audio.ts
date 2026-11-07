/**
 * Sons e música do GlycoRun 2, gerados na hora pelo navegador (Web Audio).
 * Nenhum arquivo de áudio de terceiros: não há licença a cumprir e o jogo continua leve.
 *
 * - Efeitos: notas curtas com envelope (ataque/decaimento) e ruído filtrado.
 * - Música: sequenciador simples (bateria, baixo, acordes e melodia) agendado um pouco à frente,
 *   para não falhar mesmo quando o quadro atrasa. Fica mais rápida conforme a corrida acelera.
 */

type Wave = OscillatorType;
export type Sfx =
  | "good" | "water" | "bad" | "fix" | "insulin" | "power" | "ex" | "med" | "plate"
  | "hit" | "shield" | "jump" | "doubleJump" | "land" | "slide" | "lane"
  | "quiz" | "right" | "wrong" | "boss" | "win" | "lose" | "life" | "over"
  | "tick" | "go" | "click" | "day" | "warn" | "bark";

// Escala pentatônica de dó (soa alegre e nunca "erra" nota)
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// Progressão I–V–vi–IV (dó, sol, lá menor, fá) e versão tensa para o chefão
const CHORDS = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
const BOSS_CHORDS = [[57, 60, 64], [53, 57, 60], [55, 58, 62], [52, 56, 59]];
const MELODY = [72, -1, 76, 79, 76, -1, 74, 72, 74, -1, 79, -1, 76, 74, 72, -1];
const BOSS_MELODY = [69, -1, 72, 69, 76, -1, 75, 72, 71, -1, 68, -1, 71, 72, 69, -1];

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private noise!: AudioBuffer;
  private rainSrc: AudioBufferSourceNode | null = null;
  private rainGain!: GainNode;
  muted = false;
  musicOn = false;
  private step = 0;
  private nextNote = 0;
  private timer = 0;
  tempo = 112;
  boss = false;
  private duck = 1; // música mais baixa durante o quiz e a pausa

  /** O navegador só libera som depois de um toque do jogador. */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      const comp = ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.55;
      this.sfxBus.connect(this.master);
      this.musicFilter = ctx.createBiquadFilter();
      this.musicFilter.type = "lowpass";
      this.musicFilter.frequency.value = 9000;
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0.22;
      this.musicBus.connect(this.musicFilter).connect(this.master);
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = "bandpass";
      lp.frequency.value = 1800;
      lp.Q.value = 0.6;
      this.rainGain.connect(lp).connect(this.master);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  // ---------- efeitos ----------
  private tone(freq: number, dur: number, type: Wave = "triangle", vol = 0.3, when = 0, slide = 0, bus?: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  private hiss(dur: number, freq: number, vol = 0.2, when = 0, bus?: AudioNode, q = 1): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(bus ?? this.sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }
  private arp(notes: number[], gap: number, dur: number, type: Wave = "triangle", vol = 0.22): void {
    notes.forEach((n, i) => this.tone(midi(n), dur, type, vol, i * gap));
  }

  play(name: Sfx): void {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case "good": this.arp([79, 84], 0.06, 0.16, "triangle", 0.25); break;
      case "plate": this.arp([76, 81], 0.05, 0.14, "triangle", 0.22); break;
      case "water": this.tone(520, 0.18, "sine", 0.3, 0, 500); this.tone(900, 0.1, "sine", 0.15, 0.1, 300); break;
      case "bad": this.tone(330, 0.12, "sawtooth", 0.16); this.tone(330, 0.14, "sawtooth", 0.16, 0.15); break;
      case "fix": this.arp([72, 76, 79], 0.06, 0.18, "triangle", 0.25); break;
      case "insulin": this.arp([74, 81, 86], 0.05, 0.2, "sine", 0.25); this.hiss(0.3, 3000, 0.08); break;
      case "power": this.arp([72, 76, 79, 84, 88], 0.05, 0.14, "square", 0.12); break;
      case "ex": this.arp([67, 72, 76, 79], 0.045, 0.15, "square", 0.12); break;
      case "med": this.tone(660, 0.14, "sine", 0.25); this.tone(990, 0.18, "sine", 0.18, 0.08); break;
      case "hit": this.tone(160, 0.35, "triangle", 0.5, 0, -110); this.hiss(0.25, 400, 0.35); break;
      case "shield": this.tone(880, 0.25, "sine", 0.25, 0, 400); this.hiss(0.2, 4000, 0.08); break;
      case "jump": this.tone(380, 0.14, "sine", 0.22, 0, 380); break;
      case "doubleJump": this.tone(520, 0.16, "sine", 0.22, 0, 520); this.hiss(0.15, 5000, 0.05); break;
      case "land": this.hiss(0.08, 300, 0.18); break;
      case "slide": this.hiss(0.32, 1200, 0.15, 0, undefined, 0.5); break;
      case "lane": this.hiss(0.1, 2400, 0.06, 0, undefined, 0.7); break;
      case "quiz": this.arp([76, 79, 84], 0.08, 0.2, "sine", 0.22); break;
      case "right": this.arp([72, 76, 79, 84], 0.07, 0.22, "triangle", 0.25); break;
      case "wrong": this.tone(300, 0.3, "triangle", 0.25, 0, -140); break;
      case "boss": this.tone(110, 0.5, "sawtooth", 0.2, 0, -30); this.tone(92, 0.55, "sawtooth", 0.2, 0.4, -25); break;
      case "win": this.arp([72, 76, 79, 84, 88, 91], 0.08, 0.24, "triangle", 0.22); break;
      case "lose": this.arp([67, 64, 60], 0.12, 0.25, "triangle", 0.2); break;
      case "life": this.tone(200, 0.6, "sawtooth", 0.18, 0, -120); break;
      case "over": this.arp([67, 64, 62, 60], 0.18, 0.4, "triangle", 0.22); break;
      case "tick": this.tone(660, 0.1, "square", 0.12); break;
      case "go": this.tone(990, 0.3, "square", 0.14); break;
      case "click": this.tone(1200, 0.04, "square", 0.06); break;
      case "day": this.arp([84, 88, 91], 0.1, 0.4, "sine", 0.15); break;
      case "bark":
        for (const t of [0, 0.17]) { this.tone(430, 0.09, "sawtooth", 0.13, t, -180); this.hiss(0.06, 1400, 0.09, t); }
        break;
      case "warn": this.tone(880, 0.09, "square", 0.08); this.tone(880, 0.09, "square", 0.08, 0.14); break;
    }
  }

  setRain(amount: number): void {
    if (!this.ctx) return;
    if (amount > 0.02 && !this.rainSrc) {
      const s = (this.rainSrc = this.ctx.createBufferSource());
      s.buffer = this.noise;
      s.loop = true;
      s.connect(this.rainGain);
      s.start();
    }
    this.rainGain.gain.setTargetAtTime(amount * 0.12, this.ctx.currentTime, 0.3);
    if (amount <= 0.02 && this.rainSrc) { this.rainSrc.stop(); this.rainSrc = null; }
  }

  // ---------- música ----------
  startMusic(): void {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }
  stopMusic(): void {
    this.musicOn = false;
    clearInterval(this.timer);
  }
  /** 1 = volume normal, valores menores abaixam a música (quiz, pausa). */
  setDuck(v: number): void {
    this.duck = v;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(0.22 * v, this.ctx.currentTime, 0.15);
  }
  /** Noite e hiperglicemia "abafam" a música. */
  setMood(night: number, muffled: boolean): void {
    if (!this.ctx) return;
    const f = muffled ? 900 : 9000 - night * 4500;
    this.musicFilter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.4);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicOn || this.duck === 0) { if (ctx) this.nextNote = Math.max(this.nextNote, ctx.currentTime + 0.05); return; }
    const sixteenth = 60 / this.tempo / 4;
    while (this.nextNote < ctx.currentTime + 0.12) {
      this.note(this.step, this.nextNote - ctx.currentTime);
      this.nextNote += sixteenth;
      this.step = (this.step + 1) % 64;
    }
  }

  private note(i: number, when: number): void {
    const bus = this.musicBus;
    const beat = i % 16;
    const chords = this.boss ? BOSS_CHORDS : CHORDS;
    const chord = chords[Math.floor(i / 16) % 4];
    // bateria
    if (beat % 4 === 0) this.tone(120, 0.18, "sine", 0.9, when, -70, bus); // bumbo
    if (beat === 4 || beat === 12) this.hiss(0.14, 1800, 0.45, when, bus, 0.8); // caixa
    if (beat % 2 === 0) this.hiss(0.04, 8000, 0.18, when, bus, 1.5); // chimbal
    if (this.boss && beat % 4 === 2) this.tone(90, 0.1, "sine", 0.6, when, -30, bus);
    // baixo
    if (beat % 4 === 0 || beat === 6 || beat === 14) this.tone(midi(chord[0] - 24), 0.22, "triangle", 0.55, when, 0, bus);
    // acordes curtos no contratempo
    if (beat % 4 === 2) for (const n of chord) this.tone(midi(n), 0.12, "square", 0.08, when, 0, bus);
    // melodia
    const mel = (this.boss ? BOSS_MELODY : MELODY)[beat];
    if (mel > 0 && Math.floor(i / 32) % 2 === 1) this.tone(midi(mel), 0.18, "triangle", 0.28, when, 0, bus);
  }
}

export const audio = new SoundEngine();
