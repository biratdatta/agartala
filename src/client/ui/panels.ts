/** Dialogue, Gopal's shop, food stalls, bus trips, the tomtom stand, the farm board and the ending card. */
import { HELPER_DAYS, ITEMS, MONTHS, PRICES, type BuyKey, type ItemKey } from '../../shared/constants.js';
import { DEMAND_BONUS, HAAT_ITEMS, demandOf, haatPrice, monthOf, netWorth, price, priceAt } from '../../shared/economy.js';
import { FESTIVALS, festKey, kept, nextFestival } from '../../shared/festivals.js';
import { DISHES, STALL_CLOSE, STALL_OPEN, type Stall } from '../../shared/food.js';
import { FRIENDABLE, LEVEL_NAMES, PHRASES, friendLevel, friendship, inviteToday, neighbourName } from '../../shared/friends.js';
import { ownedLunga, type GameState } from '../../shared/save.js';
import { standsFor, type Stand } from '../../shared/stands.js';
import { CHAPTERS, nextChapter } from '../../shared/story.js';
import { TRIPS, lastTrip, tripOpen, type Trip } from '../../shared/trips.js';
import { VEHICLES, owns } from '../../shared/vehicles.js';
import { play } from '../audio.js';
import type { Game } from '../game.js';
import type { FarmSummary, Net } from '../net.js';
import { $, esc, rupees, toast } from './dom.js';
import { NEIGHBOURS } from '../../shared/kaam.js';
import { kaamFor } from '../npcs.js';
import { SIGHTS, dailyDeliveries, deliveryById } from '../../shared/errands.js';
import { PANDALS, pujoSeason } from '../../shared/pujo.js';

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

/* ---------- Gopal's shop ---------- */
export function openShop(game: Game): void { $('#shop').hidden = false; renderShop(game.S); }
export function renderShop(S: GameState): void {
  const demand = demandOf(S.day);
  $('#shopSub').textContent = `Gopal Saha · rates for day ${S.day}, ${MONTHS[monthOf(S.day)]} · traders want ${ITEMS[demand].name.toLowerCase()} today (+${Math.round((DEMAND_BONUS - 1) * 100)}%)`;
  let h = '<tr><th>Sell</th><th class="r">Rate</th><th class="r">Have</th><th></th></tr>';
  for (const k of Object.keys(ITEMS) as ItemKey[]) {
    const it = ITEMS[k]; const have = S.inv[k];
    if (!have && !['paddy', 'pineapple', 'jackfruit', 'sheet', 'bamboo'].includes(k)) continue;
    const p = priceAt(k, S.day, S.market[k] || 0), base = price(k, S.day), y = price(k, Math.max(1, S.day - 1));
    const tr = S.day > 1 ? (base > y ? '<span class="up">▲</span>' : base < y ? '<span class="dn">▼</span>' : '') : '';
    const notes = [k === demand ? '<span class="up">in demand</span>' : '', p < base ? `<span class="dn">you sold a lot lately (was ₹${base})</span>` : ''].filter(Boolean).join(' · ');
    h += `<tr><td>${it.name}<div class="sm">per ${it.unit}${notes ? ' · ' + notes : ''}</div></td><td class="r">₹${p} ${tr}</td><td class="r">${have}</td><td class="r"><button class="b2" data-sell="${k}" data-n="1" ${have ? '' : 'disabled'}>Sell 1</button> <button class="b2" data-sell="${k}" data-n="all" ${have ? '' : 'disabled'}>All</button></td></tr>`;
  }
  $('#sellTbl').innerHTML = h;
  const all = S.plots.every((p) => p.owned);
  const rows: [BuyKey, string, string, boolean][] = [
    ['paddySeed', 'Paddy seed', 'one pouch sows one lunga plot', true],
    ['sucker', 'Queen pineapple sucker', 'one sucker plants one tilla bed', true],
    ['teaSapling', 'Tea sapling', `for the tea tilla · ${S.tea.filter((t) => t.planted).length} of ${S.tea.length} bushes planted · pluck every morning`, S.tea.some((t) => !t.planted)],
    ['agarSapling', 'Agar sapling', `along the lunga · ${S.agar.filter((t) => t.planted).length} of ${S.agar.length} planted · a month to grow, then worth a fortune`, S.agar.some((t) => !t.planted)],
    ['fingerling', 'Rohu and katla fingerlings', S.pond.stocked ? 'the pukur is stocked' : 'one batch stocks the pukur · net in 3 days', !S.pond.stocked],
    ['plot', 'Lunga plot', all ? 'you own the whole lunga' : `you own ${ownedLunga(S)} of 12 lunga plots`, !all],
    ['bhar', 'Bamboo bhar', S.canMax > 8 ? 'you already carry two cans' : 'two cans on a shoulder pole · 16 waterings', S.canMax <= 8],
    ['pump', 'Diesel pump set', S.pump ? 'by the pukur' : `waters every plot at once · ₹${PRICES.diesel} of diesel a day`, !S.pump],
    ['coldStore', 'Cold store', S.coldStore ? 'nothing goes off now' : 'fruit, fish and pitha stop going off overnight', !S.coldStore],
    ['helper', 'Hire a farm hand', S.helperUntil >= S.day ? `working until day ${S.helperUntil} · hire again to add ${HELPER_DAYS} days` : `waters and harvests every dawn for ${HELPER_DAYS} days`, true],
  ];
  for (const v of VEHICLES) rows.push([v.k as BuyKey, v.name, owns(S, v.k) ? 'parked by your house · walk up and press E to ride' : v.blurb, !owns(S, v.k)]);
  let b = '<tr><th>Buy</th><th class="r">Price</th><th></th></tr>';
  for (const [k, n, d, ok] of rows) b += `<tr><td>${n}<div class="sm">${d}</div></td><td class="r">₹${PRICES[k].toLocaleString('en-IN')}</td><td class="r"><button class="b2" data-buy="${k}" ${ok && S.money >= PRICES[k] ? '' : 'disabled'}>Buy</button></td></tr>`;
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

/* ---------- food stalls ---------- */
export function openStall(game: Game, st: Pick<Stall, 'id' | 'name' | 'owner' | 'menu'> & { pujo?: boolean }): void {
  const render = () => {
    const S = game.S; const open = st.pujo ? !(S.hour >= 2 && S.hour < 8) : S.hour >= STALL_OPEN && S.hour < STALL_CLOSE;
    $('#stallName').textContent = st.name; $('#stallSub').textContent = `${st.owner} · ${open ? `energy ${Math.round(S.energy)} / 100 · ₹${S.money}` : st.pujo ? 'the Puja stalls open again at 08:00' : 'shut for the night, opens at 07:00'}`;
    $('#stallList').innerHTML = st.menu.map((id) => DISHES.find((d) => d.id === id)!).map((d) => {
      const had = d.id === 'bhog' && S.flags.bhogDay === S.day;
      const can = open && S.money >= d.price && (d.takeaway || (S.energy < 100 && !had));
      const tag = d.takeaway ? `₹${d.price} · to take away${S.inv.mishti ? ` (${S.inv.mishti} in your bag)` : ''}` : d.price ? `₹${d.price} · +${d.energy} energy` : had ? 'had today · again tomorrow' : `free · +${d.energy} energy`;
      return `<button class="ride" data-dish="${d.id}" ${can ? '' : 'disabled'}><span>${esc(d.name)}<div class="sm">${esc(d.about)}</div></span><span class="sm">${tag}</span></button>`;
    }).join('');
  };
  render(); $('#stall').hidden = false;
  $('#stallClose').onclick = () => ($('#stall').hidden = true);
  $('#stallList').onclick = (e) => { const b = (e.target as HTMLElement).closest('button'); if (!b || b.disabled) return; game.dispatch({ t: 'eat', stall: st.id, dish: b.dataset.dish! }); render(); };
}

/* ---------- bus trips ---------- */
export function openTrips(game: Game, go: (t: Trip, sell?: Partial<Record<ItemKey, number>>) => void, extra?: { label: string; sub: string; run?: () => void }): void {
  const S = game.S;
  const rows = TRIPS.map((t) => {
    const why = tripOpen(S, t); const last = lastTrip(S, t.id);
    return `<button class="ride" data-trip="${t.id}" ${why && !(t.id === 'haat' && !why.startsWith('The haat')) ? 'disabled' : ''}><span class="top"><span>${esc(t.name)} · ${esc(t.where)}</span><span class="sm">${t.km} km · ₹${t.fare} · ${t.hours} h</span></span><span class="sm">${esc(t.blurb)}</span><span class="sm">${why ? esc(why) : last ? `Last went on day ${last}` : 'Not been yet'}</span></button>`;
  });
  if (extra) rows.unshift(`<button class="ride" data-extra="1" ${extra.run ? '' : 'disabled'}><span class="top"><span>${esc(extra.label)}</span></span><span class="sm">${esc(extra.sub)}</span></button>`);
  $('#tripList').innerHTML = rows.join(''); $('#haatBox').hidden = true; $('#trips').hidden = false;
  $('#tripsClose').onclick = () => ($('#trips').hidden = true);
  $('#tripList').onclick = (e) => {
    const b = (e.target as HTMLElement).closest('button'); if (!b || b.disabled) return;
    if (b.dataset.extra) { $('#trips').hidden = true; extra?.run?.(); return; }
    const t = TRIPS.find((x) => x.id === b.dataset.trip)!;
    if (t.id !== 'haat') { $('#trips').hidden = true; go(t); return; }
    // the haat: choose what to take
    const items = HAAT_ITEMS.filter((k) => S.inv[k] > 0);
    if (!items.length) { toast('You have nothing the haat traders buy: fruit, fish, tea, baskets or bamboo.'); return; }
    $('#haatList').innerHTML = items.map((k) => `<label><span>${ITEMS[k].name} · ₹${haatPrice(k, S.day)} each <span class="sm">(bazar ₹${priceAt(k, S.day, S.market[k] || 0)})</span></span><input type="number" min="0" max="${S.inv[k]}" value="${S.inv[k]}" data-haat="${k}"></label>`).join('');
    const total = () => { let t2 = 0; $('#haatList').querySelectorAll<HTMLInputElement>('input').forEach((i) => { t2 += Math.max(0, Math.min(Number(i.max), Math.floor(Number(i.value) || 0))) * haatPrice(i.dataset.haat as ItemKey, S.day); }); $('#haatTotal').textContent = `about ₹${t2}, less the ₹${t.fare} fare`; };
    $('#haatList').oninput = total; total(); $('#haatBox').hidden = false;
    $('#haatGo').onclick = () => {
      const sell: Partial<Record<ItemKey, number>> = {};
      $('#haatList').querySelectorAll<HTMLInputElement>('input').forEach((i) => { const n = Math.max(0, Math.min(Number(i.max), Math.floor(Number(i.value) || 0))); if (n) sell[i.dataset.haat as ItemKey] = n; });
      $('#trips').hidden = true; go(t, sell);
    };
  };
}

/* ---------- tomtom stand ---------- */
let rideFrom: Stand | null = null;
export function openRide(S: GameState, from: Stand, go: (to: Stand) => void): void {
  const free = !!S.flags.freeRide; const fare = free ? 'free' : `₹${PRICES.fare}`;
  const stands = standsFor(S.home);
  rideFrom = from; $('#rideSub').textContent = `${from.name} · shared e-rickshaw · ${free ? 'your first ride is paid for' : `₹${PRICES.fare} a ride`}${S.flood ? ' · the roads are mud today, rides are slow' : ''}`;
  $('#rideList').innerHTML = stands.filter((s) => s.k !== from.k).map((s) => `<button class="ride" data-ride="${s.k}" ${free || S.money >= PRICES.fare ? '' : 'disabled'}><span>${s.name}</span><span class="sm">${(Math.hypot(s.x - from.x, s.z - from.z) / 1000).toFixed(1)} km · ${fare}</span></button>`).join('');
  $('#ride').hidden = false;
  $('#ride').onclick = (e) => { const b = (e.target as HTMLElement).closest('button'); if (b?.id === 'rideClose' || e.target === $('#ride')) { $('#ride').hidden = true; return; } const to = stands.find((s) => s.k === b?.dataset.ride); if (to && rideFrom) { $('#ride').hidden = true; go(to); } };
}

/* ---------- the farm board ---------- */
export interface BoardDeps { game: Game; net: Net; auth: { available: boolean; config: { google: boolean; email: boolean; required?: boolean } }; readChapter: (id: string) => void; onState: (s: GameState) => void }
let deps: BoardDeps | null = null; let tab = 'farm'; let boardKind = 'rich'; let visiting: FarmSummary | null = null;

export function openBoard(d: BoardDeps): void { deps = d; $('#board').hidden = false; renderBoard(); }
function setTab(t: string): void {
  tab = t; document.querySelectorAll<HTMLElement>('#board .tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  document.querySelectorAll<HTMLElement>('#board section.tab').forEach((s) => (s.hidden = s.dataset.tab !== t));
  renderBoard();
}
function renderBoard(): void {
  if (!deps) return; const { game, net, auth } = deps; const S = game.S;
  if (tab === 'farm') {
    ($('#nameIn') as HTMLInputElement).value = S.name;
    $('#worth').textContent = rupees(netWorth(S));
    const kit = [...VEHICLES.filter((v) => owns(S, v.k)).map((v) => v.name.toLowerCase()), S.canMax > 8 && 'bhar', S.pump && 'pump set', S.coldStore && 'cold store', S.helperUntil >= S.day && `farm hand until day ${S.helperUntil}`].filter(Boolean);
    $('#upgrades').textContent = kit.length ? `You have: ${kit.join(', ')}` : '';
    $('#codeOut').textContent = net.online ? net.code : 'offline';
    $('#acctNote').textContent = !net.online ? 'No server is running, so this farm is saved in this browser only.' : net.signedIn ? `Signed in${net.email ? ` as ${net.email}` : ''}: this farm follows your account to any device.` : 'Playing as a guest. Keep your farm code secret: it opens this farm on any device.';
    $('#signin').hidden = !auth.available || !net.online || net.signedIn;
    $('#signOutRow').hidden = !net.signedIn;
    $('#gRow').hidden = !auth.config.google; $('#eRow').hidden = !auth.config.email;
    $('#codeIn').parentElement!.hidden = !!auth.config.required; // farm codes don't open farms when sign-in is required
    const who = (id: string) => NEIGHBOURS.find((n) => n.id === id);
    const carrying = S.carry ? deliveryById(S.carry) : null;
    $('#parcelList').innerHTML = (carrying ? `<li><b>Carrying ${esc(carrying.parcel)}</b> to ${esc(who(carrying.to)?.name || '')} · ${esc(who(carrying.to)?.para || '')}<div class="sm">Pays ${rupees(carrying.reward)} on delivery</div></li>` : '')
      + dailyDeliveries(S.day).filter((d) => d.id !== S.carry).map((d) => `<li class="${S.delivered.includes(d.id) ? 'done' : ''}">${esc(d.parcel)}: <b>${esc(who(d.from)?.name || '')}</b> → ${esc(who(d.to)?.name || '')}<div class="sm">${S.delivered.includes(d.id) ? 'Delivered' : `${d.km.toFixed(1)} km · pays ${rupees(d.reward)} · ask ${esc(who(d.from)?.name || '')} ${esc(who(d.from)?.para || '')}`}</div></li>`).join('');
    $('#sightCount').textContent = `${S.visited.length} of ${SIGHTS.length} seen`;
    $('#sightList').innerHTML = SIGHTS.map((x) => `<li class="${S.visited.includes(x.id) ? 'done' : ''}">${esc(x.name)}<div class="sm">${S.visited.includes(x.id) ? 'Seen' : '+₹25 the first time'}</div></li>`).join('');
    $('#kaamList').innerHTML = NEIGHBOURS.map((n) => ({ n, k: kaamFor(S, n.id) })).filter((x) => x.k).map(({ n, k }) => `<li class="${k!.done ? 'done' : ''}"><b>${esc(n.name)}</b> · ${esc(n.para)}<div class="sm">${k!.done ? 'Done today' : `Needs ${k!.qty} ${k!.itemName} ${k!.why} · pays ${rupees(k!.reward)}`}</div></li>`).join('') || '<li class="sm">Nobody needs anything today.</li>';
  }
  if (tab === 'people') {
    const inv = inviteToday(S);
    $('#invite').innerHTML = inv ? `<b style="color:var(--gold)">Invitation:</b> ${esc(neighbourName(inv.npc))} has invited you to ${esc(inv.what)} this evening, after 18:00.` : 'Become friends with neighbours (kaam, parcels, a chat each day) and they will invite you over.';
    $('#friendList').innerHTML = FRIENDABLE.map((id) => ({ id, pts: friendship(S, id) })).sort((a, b) => b.pts - a.pts)
      .map(({ id, pts }) => `<li><span>${esc(neighbourName(id))}</span><span class="lv">${LEVEL_NAMES[friendLevel(pts)]}</span><span class="bar"><i style="width:${pts}%"></i></span></li>`).join('');
    $('#phraseCount').textContent = `${S.phrases.length} of ${PHRASES.length}`;
    $('#phraseList').innerHTML = PHRASES.map((p) => S.phrases.includes(p.id)
      ? `<li><b>${esc(p.text)}</b> · ${esc(p.means)} <span class="sm">(${p.lang})</span></li>`
      : `<li class="locked">${p.lang} · ask ${esc(neighbourName(p.from))}</li>`).join('');
    $('#visitOut').textContent = net.online && net.visit ? net.visit : 'offline';
    $('#giftItem').innerHTML = (Object.keys(ITEMS) as ItemKey[]).filter((k) => S.inv[k] > 0).map((k) => `<option value="${k}">${ITEMS[k].name} (${S.inv[k]})</option>`).join('') || '<option value="">Nothing to send</option>';
    renderVisit();
    $('#inboxList').innerHTML = S.inbox.length ? S.inbox.slice().reverse().map((n) => `<li>${esc(n.text)}</li>`).join('') : '<li class="locked">No messages. Friends who visit or send gifts leave a note here.</li>';
  }
  if (tab === 'album') {
    const nx = nextChapter(S);
    $('#chapterCount').textContent = `${S.chapters.length} of ${CHAPTERS.length}`;
    $('#chapterList').innerHTML = CHAPTERS.map((c) => S.chapters.includes(c.id) ? `<li data-ch="${c.id}">${esc(c.title)}<div class="sm">Read again</div></li>` : nx?.id === c.id ? `<li class="ready">${esc(c.title)}<div class="sm">Grandpa is ready to tell this one. Go and talk to him.</div></li>` : `<li class="locked">A page not yet filled<div class="sm">${esc(c.hint)}</div></li>`).join('');
    const nf = nextFestival(S.day);
    $('#festList').innerHTML = FESTIVALS.map((f) => `<li class="${kept(S, f.id) ? 'done' : ''}"><b>${esc(f.name)}</b> · ${MONTHS[f.month]}${f.reward ? ` · ₹${f.reward}` : ''}<div class="sm">${kept(S, f.id) ? 'Kept this year' : nf?.f.id === f.id ? (nf.inDays ? `In ${nf.inDays} day${nf.inDays > 1 ? 's' : ''} · ` : 'On today · ') + esc(f.how) : esc(f.how)}</div></li>`).join('');
    $('#tripsDone').innerHTML = TRIPS.map((t) => { const last = lastTrip(S, t.id); return `<li class="${last ? 'done' : ''}"><b>${esc(t.name)}</b><div class="sm">${last ? `Last went on day ${last}` : `${esc(t.where)} · by bus from Radhanagar`}</div></li>`; }).join('');
    void festKey;
  }
  if (tab === 'boards') { document.querySelectorAll<HTMLElement>('#boardKinds .pujo-only').forEach((b) => { b.hidden = !pujoSeason(deps!.net.now()); }); if (pujoSeason(deps!.net.now()) && !pujoPicked) { boardKind = 'pujo'; pujoPicked = true; } void loadBoard(); }
}
function renderVisit(): void {
  const f = visiting; $('#visitCard').hidden = !f; if (!f) return;
  $('#visitInfo').innerHTML = `<b>${esc(f.name)}</b> · ${esc(f.para)} · day ${f.day}<br>Worth ${rupees(f.worth)} · ${f.planted} of ${f.plots} plots planted${f.ripe ? ` · ${f.ripe} ripe` : ''}${f.thirsty ? ` · <span style="color:#ef8a6a">${f.thirsty} thirsty</span>` : ''}<br>${f.tea ? `${f.tea} tea bushes · ` : ''}${f.pond ? 'fish in the pukur · ' : ''}${f.sights} sights seen · ${f.festivals} festivals kept`;
  ($('#helpGo') as HTMLButtonElement).disabled = !f.thirsty;
}
let pujoPicked = false; // in the Puja season the boards open on the pandal hoppers once
async function loadBoard(): Promise<void> {
  if (!deps) return; const { net } = deps; const list = $('#lbList'); const note = $('#boardNote');
  document.querySelectorAll<HTMLElement>('#boardKinds .b2').forEach((b) => b.classList.toggle('on', b.dataset.board === boardKind));
  $('#weekCat').hidden = boardKind !== 'week';
  if (!net.online) { list.innerHTML = '<li class="sm">The boards need the server.</li>'; return; }
  list.innerHTML = '<li class="sm">Loading…</li>';
  try {
    if (boardKind === 'pujo') {
      // this Puja's pandal hoppers: who saw every pandal first, and which pandals each has seen
      note.textContent = `First to see Ma Durga in all ${PANDALS.length} pandals tops the board. Name your farm (Farm tab) to appear.`;
      const b = await net.pujoBoard(); const short = (id: string) => PANDALS.find((p) => p.id === id)?.name.replace(' Sarbojanin', '').replace(' Mahila Puja Committee', ' Mahila') || id;
      list.innerHTML = b.entries.length ? b.entries.map((r) => `<li><span class="rk">${r.allAt ? '★' : r.rank}</span><span class="nm">${esc(r.name)} <span class="sm">${esc(r.para)}</span><div class="sm pujo-seen">${r.seen.map((s) => `<span>${esc(short(s))}</span>`).join('')}</div></span><span class="sm">${r.allAt ? `all ${b.total} · ${new Date(r.allAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</span><b>${r.pandals} / ${b.total}</b></li>`).join('') : '<li class="sm">Nobody has been pandal hopping yet. Be the first!</li>';
    } else if (boardKind === 'rich') {
      note.textContent = 'Net worth: cash, goods, land and kit. Only farms with a name appear.';
      const rows = await net.leaderboard();
      list.innerHTML = rows.length ? rows.map((r) => `<li><span class="rk">${r.rank}</span><span class="nm">${esc(r.name)}</span><span class="sm">day ${r.day}</span><b>${rupees(r.worth)}</b></li>`).join('') : '<li class="sm">No named farms yet. Name yours to be first.</li>';
    } else if (boardKind === 'week') {
      const cat = ($('#weekCat') as HTMLSelectElement).value;
      note.textContent = 'This week only: the boards start again every Monday.';
      const rows = await net.weekBoard(cat);
      list.innerHTML = rows.length ? rows.map((r) => `<li><span class="rk">${r.rank}</span><span class="nm">${esc(r.name)} <span class="sm">${esc(r.para)}</span></span><span class="sm"></span><b>${cat === 'earned' ? rupees(r.value) : r.value}</b></li>`).join('') : '<li class="sm">Nobody yet this week. Get going!</li>';
    } else {
      note.textContent = 'Every farm plays for the para its home is in. Totals are this week\'s earnings.';
      const rows = await net.paraBoard();
      list.innerHTML = rows.length ? rows.map((r) => `<li><span class="rk">${r.rank}</span><span class="nm">${esc(r.para)}</span><span class="sm">${r.players} farm${r.players > 1 ? 's' : ''}</span><b>${rupees(r.total)}</b></li>`).join('') : '<li class="sm">No para has earned anything yet this week.</li>';
    }
  } catch { list.innerHTML = '<li class="sm">Could not load the board.</li>'; }
}
/** Tabs, board switches, visiting and gifts: wired once. */
export function wireBoard(): void {
  document.querySelectorAll<HTMLElement>('#board .tabs button').forEach((b) => (b.onclick = () => setTab(b.dataset.tab!)));
  document.querySelectorAll<HTMLElement>('#boardKinds .b2').forEach((b) => (b.onclick = () => { boardKind = b.dataset.board!; void loadBoard(); }));
  $('#weekCat').onchange = () => void loadBoard();
  $('#chapterList').onclick = (e) => { const li = (e.target as HTMLElement).closest('li'); if (li?.dataset.ch && deps) deps.readChapter(li.dataset.ch); };
  const visit = async () => {
    if (!deps) return; const code = ($('#visitIn') as HTMLInputElement).value.trim(); if (!code) return;
    try { visiting = await deps.net.farm(code); if (visiting.visit === deps.net.visit) { visiting = null; toast('That is your own visit code.'); } renderVisit(); }
    catch (e) { visiting = null; renderVisit(); toast((e as Error).message); }
  };
  $('#visitGo').onclick = () => void visit();
  ($('#visitIn') as HTMLInputElement).addEventListener('keydown', (e) => { if (e.key === 'Enter') void visit(); });
  $('#helpGo').onclick = async () => {
    if (!deps || !visiting) return;
    try { const r = await deps.net.help(visiting.visit); deps.onState(r.state); visiting = r.farm; toast(`You watered ${r.watered} plot${r.watered > 1 ? 's' : ''} for ${visiting.name}. +₹20 from their grandfather.`); play('water'); renderBoard(); }
    catch (e) { toast((e as Error).message); }
  };
  $('#giftGo').onclick = async () => {
    if (!deps || !visiting) return; const item = ($('#giftItem') as HTMLSelectElement).value; const n = Math.floor(Number(($('#giftN') as HTMLInputElement).value) || 0);
    if (!item) return;
    try { const r = await deps.net.gift(visiting.visit, item, n); deps.onState(r.state); toast(`Sent ${n} ${ITEMS[item as ItemKey].name.toLowerCase()} to ${r.to}.`); play('coin'); renderBoard(); }
    catch (e) { toast((e as Error).message); }
  };
}

export function showEnd(S: GameState): void {
  const sold = Object.values(S.stats.sold).reduce((a: number, b) => a + (b || 0), 0);
  $('#endStats').innerHTML = [['Days', S.day], ['Paddy harvests', S.stats.harvest.paddy], ['Pineapple harvests', S.stats.harvest.pineapple], ['Rubber sheets', S.stats.sheets], ['Goods sold', sold], ['Cash', rupees(S.money)]]
    .map(([a, b]) => `<div>${a}<b>${b}</b></div>`).join('');
  $('#endcard').hidden = false;
}
