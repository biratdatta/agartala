/** Goal card, clock, money, inventory chips and the action prompt. */
import { MISSIONS, currentMission, missionText } from '../../shared/missions.js';
import { MONTHS, SEASONS } from '../../shared/constants.js';
import { monthOf } from '../../shared/economy.js';
import { festivalsOn, kept, nextFestival } from '../../shared/festivals.js';
import type { GameState } from '../../shared/save.js';
import { $, rupees } from './dom.js';

const INV: [keyof GameState['inv'], string, string][] = [
  ['paddySeed', 'Paddy seed', '#c7b27a'], ['sucker', 'Suckers', '#6f9a3a'], ['water', 'Can', '#5aa4b0'], ['paddy', 'Paddy', '#d8b64a'], ['pineapple', 'Pineapple', '#e9a23b'],
  ['jackfruit', 'Jackfruit', '#9bb446'], ['latex', 'Latex', '#e8e2d2'], ['sheet', 'Sheets', '#a9733b'], ['bamboo', 'Bamboo', '#b9c46a'],
  ['tea', 'Tea', '#8cc94a'], ['fish', 'Fish', '#9fc7d6'], ['basket', 'Baskets', '#c9a96a'], ['pitha', 'Pitha', '#f2e6c8'], ['agar', 'Agarwood', '#5a3a2a'],
  ['teaSapling', 'Tea saplings', '#5f8f35'], ['agarSapling', 'Agar saplings', '#7d6a52'], ['fingerling', 'Fingerlings', '#6a9aa0'],
];
const fmtH = (h: number) => { const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
let lastInv = '';

export interface HudInput { S: GameState; place: string; target: { x: number; z: number; stand?: boolean } | null; px: number; pz: number; yaw: number; online: boolean; lost: boolean; others?: number }
export function updateHud(h: HudInput, force = false): void {
  const { S } = h; const m = currentMission(S);
  $('#goalEyebrow').textContent = m ? `Mission ${S.mission + 1} of ${MISSIONS.length}` : 'Free play';
  $('#goalTitle').textContent = m ? m.title : 'Your city, your fields';
  $('#goalText').textContent = m ? missionText(m.text, S) : 'Every mission is done. Keep farming, chase the best rates at the bazar, and explore the city.';
  $('#goalProg').textContent = m?.progress ? m.progress(S) : '';
  const t = h.target;
  if (t) {
    const dx = t.x - h.px, dz = t.z - h.pz, d = Math.hypot(dx, dz);
    const camF = Math.atan2(-Math.sin(h.yaw), -Math.cos(h.yaw));
    $('#dirArrow').style.transform = `rotate(${-(Math.atan2(dx, dz) - camF)}rad)`;
    $('#dirDist').textContent = d < 4 ? 'Here' : `${d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km'}${t.stand ? ' to the tomtom stand' : ''}`;
    $('#goalDir').hidden = false;
  } else $('#goalDir').hidden = true;
  $('#clock').textContent = fmtH(S.hour);
  const mo = monthOf(S.day); $('#date').textContent = `Day ${S.day} · ${MONTHS[mo]} · ${SEASONS[mo]}${S.flood ? ' · flood' : S.rain ? ' · rain' : ''}`;
  const e = Math.round(S.energy); const en = $('#energy'); (en.firstElementChild as HTMLElement).style.width = `${e}%`; (en.lastElementChild as HTMLElement).textContent = `Energy ${e}`; en.classList.toggle('low', e < 20);
  const today = festivalsOn(S.day)[0], nf = nextFestival(S.day + 1);
  const fe = $('#fest'); fe.hidden = false;
  fe.textContent = today ? `${today.name} today${kept(S, today.id) ? ' · kept' : ''}` : nf && nf.inDays < 3 ? `${nf.f.name} in ${nf.inDays + 1} day${nf.inDays ? 's' : ''}` : S.helperUntil >= S.day ? `Farm hand until day ${S.helperUntil}` : '';
  if (!fe.textContent) fe.hidden = true;
  const o = $('#others'); o.hidden = !h.others; o.textContent = h.others ? `${h.others} other farmer${h.others > 1 ? 's' : ''} in the city` : '';
  $('#place').textContent = h.place;
  $('#money').textContent = rupees(S.money);
  const net = $('#net'); net.hidden = h.online && !h.lost; net.textContent = h.lost ? 'Offline · moves will sync when the server is back' : 'No server · saved in this browser only';
  const inv = INV.map(([k, n, c]) => (k === 'water' || S.inv[k] ? `<div class="chip"><i style="background:${c}"></i>${n} <b>${k === 'water' ? `${S.inv.water}/${S.canMax}` : S.inv[k]}</b></div>` : '')).join('');
  if (inv !== lastInv || force) { $('#inv').innerHTML = inv; lastInv = inv; }
}

export function setPrompt(p: { label: string; run?: () => void } | null, touch: boolean): void {
  const el = $('#prompt'); if (!p) { el.hidden = true; return; }
  el.hidden = false; el.className = p.run ? '' : 'passive';
  el.innerHTML = `<span class="key">${touch ? 'Act' : 'E'}</span><span></span>`; (el.lastChild as HTMLElement).textContent = p.label;
}
