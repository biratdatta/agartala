/**
 * Photo mode (P): hides the HUD so you can frame a shot, then saves it as a postcard with a
 * border and a caption, "Greetings from Agartala", and the place you are standing.
 */
import * as THREE from 'three';
import { $ } from './ui/dom.js';

export class PhotoMode {
  active = false;
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
  private async save(share: boolean): Promise<void> {
    const cv = this.grab();
    const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/jpeg', 0.92)); if (!blob) return;
    const file = new File([blob], `agartala-postcard-${Date.now()}.jpg`, { type: 'image/jpeg' });
    if (share && navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Greetings from Agartala' }); return; } catch { /* cancelled */ } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
}
