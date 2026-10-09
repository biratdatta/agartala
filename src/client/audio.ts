/** Every sound is synthesized in WebAudio: no audio files. */
let ctx: AudioContext | null = null;
let on = true;

function ac(): AudioContext | null {
  if (!on) return null;
  if (!ctx) { try { ctx = new AudioContext(); } catch { return null; } }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
function tone(f: number, dur: number, type: OscillatorType = 'sine', vol = 0.12, slide = 0, delay = 0): void {
  const a = ac(); if (!a) return; const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur: number, vol = 0.2, freq = 800, q = 1, delay = 0): void {
  const a = ac(); if (!a) return; const t = a.currentTime + delay;
  const n = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate); const d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = a.createBufferSource(); s.buffer = n; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain(); g.gain.value = vol; s.connect(f).connect(g).connect(a.destination); s.start(t);
}

export const SFX: Record<string, () => void> = {
  till: () => { noise(0.22, 0.35, 380, 0.8); noise(0.18, 0.25, 260, 0.8, 0.12); },
  sow: () => { for (let i = 0; i < 4; i++) noise(0.04, 0.15, 3000, 2, i * 0.05); },
  water: () => noise(0.6, 0.18, 1800, 0.6),
  harvest: () => { tone(523, 0.14, 'triangle', 0.14); tone(659, 0.14, 'triangle', 0.12, 0, 0.09); tone(784, 0.2, 'triangle', 0.12, 0, 0.18); },
  coin: () => { tone(988, 0.08, 'triangle', 0.12); tone(1319, 0.18, 'triangle', 0.12, 0, 0.07); },
  tap: () => { tone(1500, 0.04, 'square', 0.05); noise(0.08, 0.1, 2500, 3, 0.03); },
  cut: () => { noise(0.1, 0.4, 1400, 1.5); tone(180, 0.2, 'sine', 0.15, -80, 0.05); },
  talk: () => tone(392, 0.07, 'sine', 0.07),
  step: () => noise(0.05, 0.05, 520 + Math.random() * 140, 1.4),
  stepRun: () => noise(0.06, 0.09, 600 + Math.random() * 180, 1.2),
  no: () => tone(196, 0.15, 'sine', 0.08, -40),
  horn: () => { tone(620, 0.18, 'square', 0.05); tone(620, 0.18, 'square', 0.05, 0, 0.25); },
  mission: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.11, 0, i * 0.11)),
  engine: () => { tone(70, 0.5, 'sawtooth', 0.025, 15); tone(140, 0.4, 'square', 0.008, 10); },
  dhak: () => { for (let i = 0; i < 8; i++) { tone(95, 0.25, 'sine', 0.3, -40, i * 0.19 + (i % 2) * 0.05); noise(0.06, 0.25, 900, 2, i * 0.19); } },
};
export const play = (name?: string): void => { if (name && SFX[name]) SFX[name](); };
export function unlockAudio(): void { ac(); }
export function toggleSound(): boolean { on = !on; if (ctx) void (on ? ctx.resume() : ctx.suspend()); return on; }

/* ---------- ambience: rain, crickets, birds, temple bells, horns and the dhak ---------- */
function bell(f: number, vol = 0.06, delay = 0): void { for (const [m, v] of [[1, 1], [2.76, 0.5], [5.4, 0.25]] as const) tone(f * m, 3.2 / m, 'sine', vol * v, 0, delay); }
let rainNode: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
function rainLoop(level: number): void {
  const a = ac(); if (!a) return;
  if (!rainNode && level > 0) {
    const n = a.createBuffer(1, a.sampleRate * 2, a.sampleRate); const d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(); src.buffer = n; src.loop = true; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
    const gain = a.createGain(); gain.gain.value = 0; src.connect(f).connect(gain).connect(a.destination); src.start(); rainNode = { src, gain };
  }
  if (rainNode) rainNode.gain.gain.setTargetAtTime(level, a.currentTime, 1.2);
}
export interface AmbienceInput { hour: number; rain: boolean; flood: boolean; nearTraffic: number; festival: string | null; nearPandal: boolean; nearTemple: boolean; farm: boolean }
/**
 * Called about twice a second. Picks what you would hear in Agartala at this hour and place:
 * rain on the tin roofs, crickets after dark, birds at dawn, temple bells at dawn and dusk,
 * tomtom horns near traffic, and the dhak when a puja is on.
 */
export class Ambience {
  private lastBellHour = -1; private t = 0;
  update(dt: number, s: AmbienceInput): void {
    if (!on || !ctx) return; this.t += dt;
    rainLoop(s.rain ? (s.flood ? 0.09 : 0.06) : 0);
    const night = s.hour >= 19 || s.hour < 5, dawn = s.hour >= 5 && s.hour < 8;
    if (night && Math.random() < dt * (s.farm ? 3 : 1.2)) { const f = 4200 + Math.random() * 600; for (let i = 0; i < 3; i++) tone(f, 0.04, 'sine', 0.012, 0, i * 0.07); }
    if (dawn && !s.rain && Math.random() < dt * 0.9) { const f = 1800 + Math.random() * 1600; tone(f, 0.09, 'sine', 0.02, Math.random() < 0.5 ? 600 : -500); tone(f * 1.2, 0.07, 'sine', 0.015, 0, 0.12); }
    const hh = Math.floor(s.hour); if ((hh === 6 || hh === 18) && this.lastBellHour !== hh) { this.lastBellHour = hh; for (let i = 0; i < 5; i++) bell(s.nearTemple ? 520 : 440, s.nearTemple ? 0.07 : 0.03, i * 1.4); }
    if (hh !== 6 && hh !== 18) this.lastBellHour = -1;
    if (s.nearTraffic > 0 && Math.random() < dt * 0.12 * s.nearTraffic) { const f = 560 + Math.random() * 140; tone(f, 0.12, 'square', 0.015); if (Math.random() < 0.5) tone(f, 0.12, 'square', 0.015, 0, 0.18); }
    if (s.festival && s.nearPandal && Math.random() < dt * 0.5) for (let i = 0; i < 4; i++) { tone(95, 0.2, 'sine', 0.12, -40, i * 0.17 + (i % 2) * 0.04); noise(0.05, 0.1, 900, 2, i * 0.17); }
  }
}
