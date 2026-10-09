/** Holds the local game state and is the only place moves are made from. */
import { apply, type Action, type GameEvent, type Result } from '../shared/rules.js';
import type { GameState } from '../shared/save.js';
import { advance } from '../shared/time.js';
import type { Net } from './net.js';

export type FeedbackFn = (events: GameEvent[], err?: string) => void;

export class Game {
  private listeners: (() => void)[] = [];
  constructor(public S: GameState, private net: Net, private feedback: FeedbackFn) {
    net.onState = (s, rejected) => this.replace(s, rejected);
  }
  onChange(fn: () => void): void { this.listeners.push(fn); }
  private changed(): void { for (const f of this.listeners) f(); }

  /** Applies a move locally, shows its effects, and sends it to the server. */
  dispatch(a: Action): Result {
    const r = apply(this.S, a, this.net.now());
    if (!r.ok) { this.feedback(r.events, r.err); return r; }
    this.feedback(r.events); this.net.send(a, this.S); this.changed();
    return r;
  }

  /** Runs the clock. Called every frame. */
  tick(): void {
    const ev: GameEvent[] = []; const day = this.S.day, riding = !!this.S.ride, mission = this.S.mission;
    advance(this.S, this.net.now(), ev);
    if (ev.length) this.feedback(ev);
    if (this.S.day !== day || riding !== !!this.S.ride || mission !== this.S.mission) this.changed();
  }

  /** The server's answer wins. The player's position stays where it is on screen. */
  replace(s: GameState, rejected?: string): void {
    s.pos = this.S.pos; this.S = s;
    if (rejected) this.feedback([], `The server undid a move: ${rejected}`);
    this.changed();
  }
}
