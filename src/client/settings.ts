/**
 * Player settings, kept on this device (localStorage). The farm itself is saved online.
 * Everything here is looks and comfort; nothing changes the game's rules.
 */
export type TextSize = 'normal' | 'large' | 'largest';
export type Graphics = 'auto' | 'low' | 'medium' | 'high';
export interface Settings {
  /** How fast dragging turns the camera (1 = default). */
  look: number;
  /** How far you can see, in metres (fog and draw distance). */
  view: number;
  /** Sound volume, 0 to 100. */
  volume: number;
  /** Music volume (dhak and the Puja tune), 0 to 100. */
  music: number;
  text: TextSize;
  /** No bobbing markers, pulsing rings or sliding pop-ups. */
  reduceMotion: boolean;
  graphics: Graphics;
}

const KEY = 'amar-agartala.settings';
const prefersReduced = (): boolean => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
export const DEFAULTS: Settings = { look: 1, view: 1100, volume: 80, music: 60, text: 'normal', reduceMotion: prefersReduced(), graphics: 'auto' };

const clamp = (v: unknown, lo: number, hi: number, d: number): number => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
function sanitize(o: Partial<Settings>): Settings {
  return {
    look: clamp(o.look, 0.3, 3, DEFAULTS.look),
    view: clamp(o.view, 300, 1600, DEFAULTS.view),
    volume: clamp(o.volume, 0, 100, DEFAULTS.volume),
    music: clamp(o.music, 0, 100, DEFAULTS.music),
    text: o.text === 'large' || o.text === 'largest' ? o.text : 'normal',
    reduceMotion: typeof o.reduceMotion === 'boolean' ? o.reduceMotion : DEFAULTS.reduceMotion,
    graphics: o.graphics === 'low' || o.graphics === 'medium' || o.graphics === 'high' ? o.graphics : 'auto',
  };
}

let current: Settings = (() => { try { return sanitize(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return { ...DEFAULTS }; } })();
const listeners: ((s: Settings) => void)[] = [];

export const settings = (): Settings => current;
export function updateSettings(patch: Partial<Settings>): void {
  current = sanitize({ ...current, ...patch });
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* private mode: still applies this session */ }
  for (const f of listeners) f(current);
}
/** Calls f now and on every change. */
export function onSettings(f: (s: Settings) => void): void { listeners.push(f); f(current); }

/** The quality Auto starts at: phones and small machines get Medium, the rest High. */
export function autoQuality(isTouch: boolean): Exclude<Graphics, 'auto'> {
  const cores = navigator.hardwareConcurrency || 4;
  return isTouch || cores <= 4 ? 'medium' : 'high';
}
