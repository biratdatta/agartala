/**
 * Photo mode (P): hides the HUD so you can frame a shot, then saves it as a postcard with a
 * border and a caption, "Greetings from Agartala", and the place you are standing.
 */
import * as THREE from 'three';
import { $ } from './ui/dom.js';

export class PhotoMode {
  active = false;
  /** The pandal you're standing at, if any: the photo becomes a Durga Puja card. */
  pujo: () => string | null = () => null;
  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.Camera, private where: () => string, private when: () => string) {
    $('#phSave').onclick = () => void this.save(false);
    $('#phShare').onclick = () => void this.save(true);
    $('#phShare').hidden = typeof navigator.canShare !== 'function';
    $('#phExit').onclick = () => this.toggle(false);
  }
  toggle(on = !this.active): void {
    this.active = on; $('#game').classList.toggle('photo', on); $('#photobar').hidden = !on;
  }
  /** Renders a frame and reads it back straight away, before the browser clears the canvas. */
  private grab(): HTMLCanvasElement {
    const pandal = this.pujo(); if (pandal) return this.pujoCard(pandal);
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement; const W = 1600, H = Math.round((W * src.height) / src.width);
    const pad = 46, cap = 120; const cv = document.createElement('canvas'); cv.width = W + pad * 2; cv.height = H + pad + cap; const c = cv.getContext('2d')!;
    c.fillStyle = '#f6efe0'; c.fillRect(0, 0, cv.width, cv.height);
    c.drawImage(src, pad, pad, W, H);
    // a risa stripe under the photo
    const cols = ['#8c2346', '#e9b23b', '#2d3a7a', '#f6efe0', '#1f6f5c']; let x = pad;
    for (let i = 0; x < pad + W; i++) { const w = [16, 3, 12, 2, 8][i % 5] * 2; c.fillStyle = cols[i % 5]; c.fillRect(x, pad + H + 10, Math.min(w, pad + W - x), 8); x += w; }
    c.fillStyle = '#1c1624'; c.font = '54px "Tiro Bangla", Georgia, serif'; c.textBaseline = 'alphabetic'; c.fillText('Greetings from Agartala', pad, pad + H + 76);
    c.font = '28px "Hind Siliguri", system-ui, sans-serif'; c.fillStyle = '#5a4a3a'; c.fillText(`${this.where()} · ${this.when()}`, pad, pad + H + 112);
    c.textAlign = 'right'; c.fillStyle = '#8c2346'; c.font = '40px "Tiro Bangla", Georgia, serif'; c.fillText('আগরতলা', pad + W, pad + H + 76);
    return cv;
  }
  /**
   * The Durga Puja card: the shot in a red-and-gold frame with an alpona border, "Shubho Durga Puja
   * from Agartala" in English and Bangla, the pandal's name, and the game's address, so every card
   * that's shared brings someone home.
   */
  private pujoCard(pandal: string): HTMLCanvasElement {
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement; const W = 1080, H = Math.round(Math.min(1.25, src.height / src.width) * W);
    const pad = 54, top = 150, bot = 210; const cv = document.createElement('canvas'); cv.width = W + pad * 2; cv.height = H + top + bot; const c = cv.getContext('2d')!;
    // red ground with a gold inner border and alpona dots
    c.fillStyle = '#9b1b1f'; c.fillRect(0, 0, cv.width, cv.height);
    c.strokeStyle = '#e9b23b'; c.lineWidth = 6; c.strokeRect(18, 18, cv.width - 36, cv.height - 36);
    c.fillStyle = '#f6efe0';
    for (let x = 34; x < cv.width - 20; x += 26) for (const y of [34, cv.height - 34]) { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); }
    for (let y = 60; y < cv.height - 40; y += 26) for (const x of [34, cv.width - 34]) { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); }
    // the photo, with a thin white mount
    const sw = src.width, sh = Math.min(src.height, Math.round(sw * (H / W))); const sy = Math.round((src.height - sh) / 2);
    c.fillStyle = '#f6efe0'; c.fillRect(pad - 8, top - 8, W + 16, H + 16); c.drawImage(src, 0, sy, sw, sh, pad, top, W, H);
    c.textAlign = 'center'; c.fillStyle = '#ffd25a'; c.font = '600 30px "Hind Siliguri", system-ui, sans-serif'; c.fillText('শুভ দুর্গাপূজা  ·  শুভ বিজয়া', cv.width / 2, 72);
    c.fillStyle = '#f6efe0'; c.font = '64px "Tiro Bangla", Georgia, serif'; c.fillText('Shubho Durga Puja from Agartala', cv.width / 2, 126);
    c.font = '600 34px "Hind Siliguri", system-ui, sans-serif'; c.fillStyle = '#ffd25a'; c.fillText(`${pandal} · ${this.when()}`, cv.width / 2, top + H + 64);
    c.fillStyle = '#f6efe0'; c.font = '30px "Hind Siliguri", system-ui, sans-serif'; c.fillText('Come home to Agartala this Pujo, in the game', cv.width / 2, top + H + 116);
    c.fillStyle = '#e9b23b'; c.font = '700 36px "Hind Siliguri", system-ui, sans-serif'; c.fillText('agartala.biratdatta.tech', cv.width / 2, top + H + 166);
    return cv;
  }
  private async save(share: boolean): Promise<void> {
    const cv = this.grab(); const pujo = this.pujo();
    const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/jpeg', 0.92)); if (!blob) return;
    const file = new File([blob], `${pujo ? 'shubho-durga-puja' : 'agartala-postcard'}-${Date.now()}.jpg`, { type: 'image/jpeg' });
    const text = pujo ? `Shubho Durga Puja from ${pujo}, Agartala! Come pandal hopping with me: https://agartala.biratdatta.tech/` : 'Greetings from Agartala: https://agartala.biratdatta.tech/';
    if (share && navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: pujo ? 'Shubho Durga Puja' : 'Greetings from Agartala', text }); return; } catch { /* cancelled */ } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
}
