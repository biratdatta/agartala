/** Dialogue, Gopal's shop, the tomtom stand, the leaderboard/account panel and the ending card. */
import { ITEMS, MONTHS, PRICES, type BuyKey, type ItemKey } from '../../shared/constants.js';
import { monthOf, netWorth, price } from '../../shared/economy.js';
import { ownedLunga, type GameState } from '../../shared/save.js';
import { STANDS, type Stand } from '../../shared/stands.js';
import { play } from '../audio.js';
import type { Game } from '../game.js';
import type { Net } from '../net.js';
import { $, esc, rupees } from './dom.js';
import { NEIGHBOURS } from '../../shared/kaam.js';
import { kaamFor } from '../npcs.js';
import { SIGHTS, dailyDeliveries, deliveryById } from '../../shared/errands.js';

/* ---------- dialogue ---------- */
let pages: string[] = []; let onDone: (() => void) | null = null;
export function dialog(who: { name: string; role: string }, text: string[], done?: () => void): void {
  play('talk'); pages = text.slice(); onDone = done || null;
  $('#dlgName').textContent = who.name; $('#dlgRole').textContent = who.role; $('#dialog').hidden = false; nextPage();
}
export function nextPage(): void {
  if (!pages.length) { $('#dialog').hidden = true; const f = onDone; onDone = null; f?.(); return; }
  $('#dlgText').textContent = pages.shift()!; $('#dlgNext').textContent = pages.length ? 'Continue' : 'Done'; play('talk');
}

/* ---------- shop ---------- */
export function openShop(game: Game): void { $('#shop').hidden = false; renderShop(game.S); }
export function renderShop(S: GameState): void {
  $('#shopSub').textContent = `Gopal Saha · rates for day ${S.day}, ${MONTHS[monthOf(S.day)]}`;
  let h = '<tr><th>Sell</th><th class="r">Rate</th><th class="r">Have</th><th></th></tr>';
  for (const k of Object.keys(ITEMS) as ItemKey[]) {
    const it = ITEMS[k]; const p = price(k, S.day), y = price(k, Math.max(1, S.day - 1));
    const tr = S.day > 1 ? (p > y ? '<span class="up">▲</span>' : p < y ? '<span class="dn">▼</span>' : '') : '';
    const have = S.inv[k];
    h += `<tr><td>${it.name}<div class="sm">per ${it.unit}</div></td><td class="r">₹${p} ${tr}</td><td class="r">${have}</td><td class="r"><button class="b2" data-sell="${k}" data-n="1" ${have ? '' : 'disabled'}>Sell 1</button> <button class="b2" data-sell="${k}" data-n="all" ${have ? '' : 'disabled'}>All</button></td></tr>`;
  }
  $('#sellTbl').innerHTML = h;
  const all = S.plots.every((p) => p.owned);
  const rows: [BuyKey, string, string, boolean][] = [
    ['paddySeed', 'Paddy seed', 'one pouch sows one lunga plot', true],
    ['sucker', 'Queen pineapple sucker', 'one sucker plants one tilla bed', true],
    ['plot', 'Lunga plot', all ? 'you own the whole lunga' : `you own ${ownedLunga(S)} of 12 lunga plots`, !all],
    ['bhar', 'Bamboo bhar', S.canMax > 8 ? 'you already carry two cans' : 'two cans on a shoulder pole · 16 waterings', S.canMax <= 8],
    ['cycle', 'Bicycle', S.cycle ? 'you have one' : 'twice as fast through the lanes', !S.cycle],
  ];
  let b = '<tr><th>Buy</th><th class="r">Price</th><th></th></tr>';
  for (const [k, n, d, ok] of rows) b += `<tr><td>${n}<div class="sm">${d}</div></td><td class="r">₹${PRICES[k]}</td><td class="r"><button class="b2" data-buy="${k}" ${ok && S.money >= PRICES[k] ? '' : 'disabled'}>Buy</button></td></tr>`;
  $('#buyTbl').innerHTML = b;
}
export function wireShop(game: Game): void {
  $('#shopClose').onclick = () => ($('#shop').hidden = true);
  $('#shop').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button'); if (!b || b.disabled) return;
    if (b.dataset.sell) { const k = b.dataset.sell as ItemKey; game.dispatch({ t: 'sell', item: k, n: b.dataset.n === 'all' ? game.S.inv[k] : 1 }); }
    if (b.dataset.buy) game.dispatch({ t: 'buy', item: b.dataset.buy as BuyKey });
    renderShop(game.S);
  });
}

/* ---------- tomtom stand ---------- */
let rideFrom: Stand | null = null;
export function openRide(S: GameState, from: Stand, go: (to: Stand) => void): void {
  const free = !!S.flags.freeRide; const fare = free ? 'free' : `₹${PRICES.fare}`;
  rideFrom = from; $('#rideSub').textContent = `${from.name} · shared e-rickshaw · ${free ? 'your first ride is paid for' : `₹${PRICES.fare} a ride`}`;
  $('#rideList').innerHTML = STANDS.filter((s) => s !== from).map((s) => `<button class="ride" data-ride="${s.k}" ${free || S.money >= PRICES.fare ? '' : 'disabled'}><span>${s.name}</span><span class="sm">${(Math.hypot(s.x - from.x, s.z - from.z) / 1000).toFixed(1)} km · ${fare}</span></button>`).join('');
  $('#ride').hidden = false;
  $('#ride').onclick = (e) => { const b = (e.target as HTMLElement).closest('button'); if (b?.id === 'rideClose' || e.target === $('#ride')) { $('#ride').hidden = true; return; } const to = STANDS.find((s) => s.k === b?.dataset.ride); if (to && rideFrom) { $('#ride').hidden = true; go(to); } };
}

/* ---------- farm, leaderboard, account ---------- */
export async function openBoard(game: Game, net: Net, auth: { available: boolean; config: { google: boolean; email: boolean } }): Promise<void> {
  const S = game.S; $('#board').hidden = false;
  ($('#nameIn') as HTMLInputElement).value = S.name;
  $('#worth').textContent = rupees(netWorth(S));
  $('#codeOut').textContent = net.online ? net.code : 'offline';
  $('#acctNote').textContent = !net.online ? 'No server is running, so this farm is saved in this browser only.' : net.signedIn ? `Signed in${net.email ? ` as ${net.email}` : ''}: this farm follows your account to any device.` : 'Playing as a guest. Keep your farm code to open this farm on another device.';
  $('#signin').hidden = !auth.available || !net.online || net.signedIn;
  $('#gRow').hidden = !auth.config.google; $('#eRow').hidden = !auth.config.email;
  const who = (id: string) => NEIGHBOURS.find((n) => n.id === id);
  const carrying = S.carry ? deliveryById(S.carry) : null;
  $('#parcelList').innerHTML = (carrying ? `<li><b>Carrying ${esc(carrying.parcel)}</b> to ${esc(who(carrying.to)?.name || '')} · ${esc(who(carrying.to)?.para || '')}<div class="sm">Pays ${rupees(carrying.reward)} on delivery</div></li>` : '')
    + dailyDeliveries(S.day).filter((d) => d.id !== S.carry).map((d) => `<li class="${S.delivered.includes(d.id) ? 'done' : ''}">${esc(d.parcel)}: <b>${esc(who(d.from)?.name || '')}</b> → ${esc(who(d.to)?.name || '')}<div class="sm">${S.delivered.includes(d.id) ? 'Delivered' : `${d.km.toFixed(1)} km · pays ${rupees(d.reward)} · ask ${esc(who(d.from)?.name || '')} ${esc(who(d.from)?.para || '')}`}</div></li>`).join('');
  $('#sightCount').textContent = `${S.visited.length} of ${SIGHTS.length} seen`;
  $('#sightList').innerHTML = SIGHTS.map((x) => `<li class="${S.visited.includes(x.id) ? 'done' : ''}">${esc(x.name)}<div class="sm">${S.visited.includes(x.id) ? 'Seen' : '+₹25 the first time'}</div></li>`).join('');
  $('#kaamList').innerHTML = NEIGHBOURS.map((n) => ({ n, k: kaamFor(S, n.id) })).filter((x) => x.k).map(({ n, k }) => `<li class="${k!.done ? 'done' : ''}"><b>${esc(n.name)}</b> · ${esc(n.para)}<div class="sm">${k!.done ? 'Done today' : `Needs ${k!.qty} ${k!.itemName} ${k!.why} · pays ${rupees(k!.reward)}`}</div></li>`).join('') || '<li class="sm">Nobody needs anything today.</li>';
  const list = $('#lbList');
  if (!net.online) { list.innerHTML = '<li class="sm">The leaderboard needs the server.</li>'; return; }
  list.innerHTML = '<li class="sm">Loading…</li>';
  try {
    const rows = await net.leaderboard();
    list.innerHTML = rows.length ? rows.map((r) => `<li><span class="rk">${r.rank}</span><span class="nm">${esc(r.name)}</span><span class="sm">day ${r.day}</span><b>${rupees(r.worth)}</b></li>`).join('') : '<li class="sm">No named farms yet. Name yours to be first.</li>';
  } catch { list.innerHTML = '<li class="sm">Could not load the leaderboard.</li>'; }
}

export function showEnd(S: GameState): void {
  const sold = Object.values(S.stats.sold).reduce((a: number, b) => a + (b || 0), 0);
  $('#endStats').innerHTML = [['Days', S.day], ['Paddy harvests', S.stats.harvest.paddy], ['Pineapple harvests', S.stats.harvest.pineapple], ['Rubber sheets', S.stats.sheets], ['Goods sold', sold], ['Cash', rupees(S.money)]]
    .map(([a, b]) => `<div>${a}<b>${b}</b></div>`).join('');
  $('#endcard').hidden = false;
}
