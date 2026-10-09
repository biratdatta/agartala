export const $ = <T extends HTMLElement = HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing element ${sel}`);
  return el;
};
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const rupees = (n: number): string => '₹' + Math.round(n).toLocaleString('en-IN');

/** Short messages at the top of the screen. `title` makes a bigger, gold-edged card. */
export function toast(text: string, title?: string): void {
  const box = $('#toasts'); const t = document.createElement('div'); t.className = 'toast' + (title ? ' big' : '');
  if (title) { const b = document.createElement('b'); b.textContent = title; t.appendChild(b); }
  t.appendChild(document.createTextNode(text)); box.appendChild(t);
  while (box.children.length > 3) box.firstChild?.remove();
  setTimeout(() => t.remove(), title ? 5200 : 2800);
}

const OVERLAYS = ['#dialog', '#shop', '#ride', '#bigmap', '#help', '#endcard', '#title', '#board', '#stall', '#trips'];
export const modalOpen = (): boolean => OVERLAYS.some((s) => !$(s).hidden);
export const closePanels = (): void => { for (const s of ['#shop', '#ride', '#bigmap', '#help', '#endcard', '#board', '#stall', '#trips']) $(s).hidden = true; };

export function fade(on: boolean): void { $('#fade').classList.toggle('on', on); }
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
