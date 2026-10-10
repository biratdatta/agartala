/**
 * Puja music, all synthesized (no recordings): a dhak rhythm with the kansar bell, a harmonium tune
 * in Raga Durga (Sa Re Ma Pa Dha, the raga named for Ma Durga) over a tanpura drone, and the
 * shankh (conch) at aarti. On the title screen the theme plays in full; out in the city during
 * the Puja you hear the tune faintly, as if from a loudspeaker tied to a pole, and the dhak grows
 * louder as you near a pandal. The tune is original, composed for the game.
 */
import { audioCtx, masterBus, soundOn } from './audio.js';

export type MusicMode = 'off' | 'title' | 'city';
const BPM = 96, STEP = 60 / BPM / 4; // sixteenth notes
/** Raga Durga on D: Sa Re Ma Pa Dha (D E G A B), across three octaves. Index 0 = low Sa. */
const SA = 146.83; const RATIOS = [1, 9 / 8, 4 / 3, 3 / 2, 5 / 3];
const note = (deg: number): number => SA * RATIOS[((deg % 5) + 5) % 5] * 2 ** Math.floor(deg / 5);
/** The tune, in eighth notes: scale degrees (5 = upper Sa), null = rest, '-' = hold. Four 8-bar lines. */
const TUNE: (number | null | '-')[] = [
  // Line 1: it opens on the upper Sa, falls through Dha and Pa, and settles on Ma
  10, 9, 8, '-', 7, 8, 9, '-', 10, '-', 9, 8, 7, '-', null, null,
  7, 8, 9, 10, 11, 10, 9, '-', 8, 9, 8, 7, 6, '-', null, null,
  // Line 2: lower, gentler, answering
  5, 6, 7, '-', 8, 7, 6, '-', 7, 8, 9, 8, 7, '-', '-', null,
  6, 7, 8, 7, 6, 5, 6, '-', 5, '-', '-', '-', null, null, null, null,
  // Line 3: climbing, the dhak picks up
  7, 8, 9, 10, 9, 10, 11, '-', 12, 11, 10, 9, 10, '-', null, null,
  12, 11, 10, 11, 10, 9, 8, '-', 9, 10, 9, 8, 7, '-', null, null,
  // Line 4: home to Sa
  8, 9, 10, '-', 9, 8, 7, '-', 8, 7, 6, 7, 6, 5, '-', '-',
  6, 7, 6, 5, 6, '-', 5, '-', 5, '-', '-', '-', null, null, null, null,
];
/** Dhak, one bar of 16 steps: 2 = heavy "dhum", 1 = slap "ta", 0 = rest. Kansar on the beats. */
const DHAK = [2, 0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 1, 2, 1];

export class PujoMusic {
  private mode: MusicMode = 'off';
  private bus: GainNode | null = null; private tuneBus: GainNode | null = null; private dhakBus: GainNode | null = null; private speaker: GainNode | null = null;
  private drone: { g: GainNode; o: OscillatorNode[] } | null = null;
  private next = 0; private step = 0; private volume = 0.6; private dhak = 0; private lastConch = 0;

  constructor() { setInterval(() => this.tick(), 40); }
  /** 0 to 1, from Settings. */
  setVolume(v: number): void { this.volume = Math.max(0, Math.min(1, v)); }
  /** What to play, and how loud the dhak is (0 far from any pandal, 1 right by one). */
  set(mode: MusicMode, dhak = 0): void { this.mode = mode; this.dhak = Math.max(0, Math.min(1, dhak)); }

  /** Three long blows of the shankh, as at the start of aarti. */
  conch(level = 1): void {
    const a = audioCtx(); if (!a || !this.bus || a.currentTime - this.lastConch < 25) return; this.lastConch = a.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = a.currentTime + 0.1 + i * 2.1; const o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(233, t); o.frequency.linearRampToValueAtTime(247, t + 1.5);
      lfo.frequency.value = 5.2; lg.gain.value = 3; lfo.connect(lg).connect(o.frequency);
      f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 3;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11 * level, t + 0.35); g.gain.setValueAtTime(0.11 * level, t + 1.3); g.gain.linearRampToValueAtTime(0, t + 1.8);
      o.connect(f).connect(g).connect(this.bus); o.start(t); lfo.start(t); o.stop(t + 1.9); lfo.stop(t + 1.9);
    }
  }

  private ensure(a: AudioContext): void {
    if (this.bus) return;
    this.bus = a.createGain(); this.bus.gain.value = 0; this.bus.connect(masterBus(a));
    this.tuneBus = a.createGain(); this.dhakBus = a.createGain();
    this.tuneBus.connect(this.bus); this.dhakBus.connect(this.bus);
    // the loudspeaker: narrow band, a little crackle and an echo off the houses
    this.speaker = a.createGain(); const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.8;
    const sh = a.createWaveShaper(); const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; curve[i] = Math.tanh(x * 2.4); } sh.curve = curve;
    const dl = a.createDelay(1); dl.delayTime.value = 0.23; const fb = a.createGain(); fb.gain.value = 0.32;
    this.speaker.connect(bp).connect(sh); sh.connect(this.bus); sh.connect(dl); dl.connect(fb).connect(dl); dl.connect(this.bus);
  }
  /** The tanpura drone: Sa, Pa and the upper Sa, breathing slowly. */
  private droneOn(a: AudioContext, on: boolean): void {
    if (on && !this.drone && this.tuneBus) {
      const g = a.createGain(); g.gain.value = 0; g.connect(this.tuneBus);
      const o = [SA / 2, (SA / 2) * 1.5, SA].map((f, i) => { const os = a.createOscillator(); os.type = i ? 'triangle' : 'sine'; os.frequency.value = f; os.detune.value = (i - 1) * 3; const og = a.createGain(); og.gain.value = [0.05, 0.025, 0.02][i]; os.connect(og).connect(g); os.start(); return os; });
      g.gain.setTargetAtTime(1, a.currentTime, 1.5); this.drone = { g, o };
    } else if (!on && this.drone) { const d = this.drone; d.g.gain.setTargetAtTime(0, a.currentTime, 0.6); setTimeout(() => d.o.forEach((o) => o.stop()), 3000); this.drone = null; }
  }

  private tick(): void {
    const a = audioCtx(); if (!a || !soundOn()) return; this.ensure(a);
    const playing = this.mode !== 'off' && this.volume > 0;
    const city = this.mode === 'city';
    const target = playing ? this.volume * (city ? 0.9 : 0.75) : 0; this.bus!.gain.setTargetAtTime(target, a.currentTime, 0.8);
    this.dhakBus!.gain.setTargetAtTime(city ? this.dhak * 0.9 : 0.45, a.currentTime, 0.5);
    this.droneOn(a, playing && !city);
    if (!playing) { this.next = 0; return; }
    if (this.next < a.currentTime) this.next = a.currentTime + 0.05;
    while (this.next < a.currentTime + 0.18) { this.play(a, this.step, this.next, city); this.step++; this.next += STEP; }
  }

  private play(a: AudioContext, step: number, t: number, city: boolean): void {
    const s16 = step % 16;
    // dhak and kansar
    const d = DHAK[s16]; if (d && (!city || this.dhak > 0.02)) this.drum(a, t, d === 2);
    if (s16 % 4 === 0 && (!city || this.dhak > 0.02)) this.kansar(a, t, s16 === 0 ? 1 : 0.6);
    // the tune: an eighth note every two steps
    if (step % 2 === 0) {
      const i = (step / 2) % TUNE.length; const n = TUNE[i];
      if (typeof n === 'number') { let len = 1; while (TUNE[(i + len) % TUNE.length] === '-') len++; this.harmonium(a, t, note(n), len * STEP * 2 * 0.95, city); }
    }
  }
  private drum(a: AudioContext, t: number, heavy: boolean): void {
    const o = a.createOscillator(), g = a.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(heavy ? 105 : 190, t); o.frequency.exponentialRampToValueAtTime(heavy ? 52 : 120, t + (heavy ? 0.28 : 0.09));
    g.gain.setValueAtTime(heavy ? 0.5 : 0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + (heavy ? 0.35 : 0.12));
    o.connect(g).connect(this.dhakBus!); o.start(t); o.stop(t + 0.4);
    // the stick's slap on the skin
    const n = a.createBuffer(1, Math.floor(a.sampleRate * 0.06), a.sampleRate); const ch = n.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length) ** 2;
    const src = a.createBufferSource(); src.buffer = n; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = heavy ? 700 : 1900; f.Q.value = 1.2;
    const ng = a.createGain(); ng.gain.value = heavy ? 0.18 : 0.3; src.connect(f).connect(ng).connect(this.dhakBus!); src.start(t);
  }
  private kansar(a: AudioContext, t: number, v: number): void {
    for (const [f, k] of [[2350, 1], [3520, 0.6], [5100, 0.3]] as const) {
      const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.03 * v * k, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.45); o.connect(g).connect(this.dhakBus!); o.start(t); o.stop(t + 0.5);
    }
  }
  private harmonium(a: AudioContext, t: number, f: number, len: number, city: boolean): void {
    const g = a.createGain(), lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700; lp.Q.value = 0.6;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(city ? 0.06 : 0.075, t + 0.04); g.gain.setValueAtTime(city ? 0.06 : 0.075, t + Math.max(0.05, len - 0.08)); g.gain.linearRampToValueAtTime(0, t + len);
    for (const det of [-5, 5]) { const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + len + 0.02); }
    const sq = a.createOscillator(); sq.type = 'square'; sq.frequency.value = f / 2; const sg = a.createGain(); sg.gain.value = 0.25; sq.connect(sg).connect(lp); sq.start(t); sq.stop(t + len + 0.02);
    lp.connect(g).connect(city ? this.speaker! : this.tuneBus!);
  }
}
