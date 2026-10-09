/** What E does in front of each thing, the prompt that says so, and who says what. */
import { AGAR_NEED, FISH_NEED, NEED, PRICES, TAP_FROM, TAP_UNTIL, TEA_NEED, type ItemKey } from '../shared/constants.js';
import { monthOf } from '../shared/economy.js';
import { AGAR, BAMBOO, CRAFT, FIELD, HILLS, JACK, PLOTS, POND, PUMP, RINA, ROLLER, RUBBER, TEA, type XZ } from '../shared/farm.js';
import { festById, isFestival, kept, kerClosed, pithaSeason } from '../shared/festivals.js';
import { INVITE_FROM, INVITE_UNTIL, inviteToday } from '../shared/friends.js';
import { chapterById, nextChapter } from '../shared/story.js';
import { yearOf } from '../shared/economy.js';
import { PLUCK_FROM, PLUCK_UNTIL } from '../shared/rules.js';
import type { Trip } from '../shared/trips.js';
import type { StallView } from './scene/citylife.js';
import { KER_SPOT } from './scene/citylife.js';
import { NEIGHBOURS } from '../shared/kaam.js';
import { SIGHTS, SIGHT_REWARD, dailyDeliveries, deliveryById } from '../shared/errands.js';
import { currentMission } from '../shared/missions.js';
import type { GameState } from '../shared/save.js';
import { SPOTS } from '../shared/spots.js';
import { standByKey, standsFor, type Stand } from '../shared/stands.js';
import { isNight } from '../shared/time.js';
import type { Game } from './game.js';
import type { CityMap } from './map/data.js';
import type { Npc, NpcKey } from './scene/landmarks.js';
import type { HomeView } from './home.js';
import { dialog, openRide, openShop, openStall, openTrips } from './ui/panels.js';
import { kaamFor, passerby, type NeighbourNpc } from './npcs.js';
import type { Traffic } from './scene/people.js';

export interface Prompt { label: string; run?: () => void }
export interface Spot extends XZ { r: number; get: () => Prompt }
export interface Ctx {
  game: Game; map: CityMap; npc: Record<NpcKey, Npc>; neighbours: NeighbourNpc[]; traffic: Traffic; home: HomeView; stalls: StallView[];
  sleep: () => void; ride: (from: Stand, to: Stand) => void; kharchiTrip: () => void;
  /** Goes on a bus trip: fades out, shows the arrival pages, then applies the trip. */
  trip: (t: Trip, sell?: Partial<Record<ItemKey, number>>) => void;
  fair: () => void;
  player: () => { x: number; z: number; face: number };
}

const CROP = { paddy: 'paddy', pineapple: 'pineapples' } as const;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function buildSpots(c: Ctx): Spot[] {
  const S = () => c.game.S; const act = c.game.dispatch.bind(c.game);
  const out: Spot[] = [];
  PLOTS.forEach((p, i) => out.push({ x: p.x, z: p.z, r: p.kind === 'lunga' ? 3 : 2.4, get: () => {
    const s = S(), q = s.plots[i];
    if (!q.owned) return { label: `Not your plot yet · buy it from Gopal at Math Chowmuhani (₹${PRICES.plot})` };
    if (q.state === 'grass') return { label: p.kind === 'lunga' ? 'Till the lunga' : 'Hoe the terrace bed', run: () => act({ t: 'till', plot: i }) };
    if (!q.crop) {
      if (p.kind === 'lunga') return s.inv.paddySeed > 0 ? { label: `Sow paddy · ${s.inv.paddySeed} seed pouch${s.inv.paddySeed > 1 ? 'es' : ''}`, run: () => act({ t: 'sow', plot: i }) } : { label: 'No paddy seed · buy some at Lake Chowmuhani' };
      return s.inv.sucker > 0 ? { label: `Plant pineapple suckers · ${s.inv.sucker} left`, run: () => act({ t: 'sow', plot: i }) } : { label: 'No pineapple suckers · Gopal sells them' };
    }
    const need = NEED[q.crop];
    if (q.growth >= need) return { label: `Harvest the ${CROP[q.crop]}`, run: () => act({ t: 'harvest', plot: i }) };
    if (!q.watered) return s.inv.water > 0 ? { label: `Water the ${CROP[q.crop]} · can ${s.inv.water}/${s.canMax}`, run: () => act({ t: 'water', plot: i }) } : { label: 'The can is empty · fill it at the pukur behind the house' };
    return { label: `${cap(CROP[q.crop])} growing · ${Math.floor((q.growth / need) * 100)}% · watered today` };
  } }));
  RUBBER.forEach((t, i) => out.push({ ...t, r: 1.8, get: () => {
    const s = S(); if (s.trees[i].tapped === s.day) return { label: 'Tapped today · the latex runs again tomorrow at dawn' };
    if (s.hour < TAP_FROM || s.hour >= TAP_UNTIL) return { label: 'Rubber is tapped at dawn, 05:00 to 11:00' };
    return { label: 'Tap the rubber tree', run: () => act({ t: 'tap', tree: i }) };
  } }));
  BAMBOO.forEach((b, i) => out.push({ ...b, r: 2.4, get: () => {
    const s = S(); return s.bamboo[i].ready > s.day ? { label: `New culms are coming up · ready on day ${s.bamboo[i].ready}` } : { label: 'Cut bamboo with your dao', run: () => act({ t: 'cut', clump: i }) };
  } }));
  JACK.forEach((j, i) => out.push({ ...j, r: 2.2, get: () => {
    const s = S(); if (s.jack[i].fruits > 0) return { label: 'Pick a jackfruit', run: () => act({ t: 'pick', tree: i }) };
    return { label: monthOf(s.day) <= 4 ? 'No ripe jackfruit today · more tomorrow' : 'Jackfruit season is Boishakh to Bhadro' };
  } }));
  TEA.forEach((t, i) => out.push({ ...t, r: 1.8, get: () => {
    const s = S(), b = s.tea[i];
    if (!b.planted) return s.inv.teaSapling > 0 ? { label: `Plant a tea sapling · ${s.inv.teaSapling} left`, run: () => act({ t: 'plant', kind: 'tea', i }) } : { label: `Tea tilla · buy saplings from Gopal (₹${PRICES.teaSapling})` };
    if (b.growth < TEA_NEED) return { label: `Young tea bush · ${Math.floor((b.growth / TEA_NEED) * 100)}% grown` };
    if (b.picked === s.day) return { label: 'Plucked today · new leaves by tomorrow' };
    if (s.hour < PLUCK_FROM || s.hour >= PLUCK_UNTIL) return { label: 'Tea is plucked in the morning, 05:00 to 14:00' };
    return { label: 'Pluck two leaves and a bud', run: () => act({ t: 'pluck', i }) };
  } }));
  AGAR.forEach((t, i) => out.push({ ...t, r: 1.8, get: () => {
    const s = S(), b = s.agar[i];
    if (!b.planted) return s.inv.agarSapling > 0 ? { label: `Plant an agar sapling · ${s.inv.agarSapling} left`, run: () => act({ t: 'plant', kind: 'agar', i }) } : { label: `A spot for agar · saplings from Gopal (₹${PRICES.agarSapling})` };
    if (b.growth < AGAR_NEED) return { label: `Agar tree · resin forming · ready in about ${Math.ceil((AGAR_NEED - b.growth) / 24)} days` };
    return { label: 'Fell the agar tree for its fragrant wood', run: () => act({ t: 'fell', i }) };
  } }));
  out.push({ ...PUMP, r: 2.4, get: () => {
    const s = S(), p = s.pond;
    if (p.stocked && p.growth >= FISH_NEED) return { label: 'Haul the net: the fish are ready', run: () => act({ t: 'net' }) };
    if (!p.stocked && s.inv.fingerling > 0) return { label: 'Stock the pukur with fingerlings', run: () => act({ t: 'stock' }) };
    const thirsty = s.plots.some((q) => q.owned && q.crop && !q.watered && q.growth < NEED[q.crop]);
    if (s.pump && s.pumpDay !== s.day && thirsty) return { label: `Run the pump to water every plot · ₹${PRICES.diesel} diesel`, run: () => act({ t: 'pump' }) };
    if (p.stocked) return { label: `Fish growing in the pukur · ${Math.floor((p.growth / FISH_NEED) * 100)}%` };
    return { label: s.pump ? (s.pumpDay === s.day ? 'The pump ran today' : 'Everything is watered') : 'The pukur ghat · Gopal sells fingerlings and pump sets' };
  } });
  out.push({ ...CRAFT, r: 2, get: () => (S().inv.bamboo >= 2 ? { label: `Weave a cane basket · 2 bamboo culms, an hour (you have ${S().inv.bamboo})`, run: () => act({ t: 'craft' }) } : { label: 'Craft bench · 2 bamboo culms make a basket' }) });
  for (const st of c.stalls) out.push({ x: st.x, z: st.z, r: 2.2, get: () => ({ label: `${st.name} · eat something`, run: () => openStall(c.game, st) }) });
  out.push({ ...KER_SPOT, r: 3, get: () => {
    const s = S(); if (!isFestival(s.day, 'ker')) return { label: 'The stadium gate' };
    if (kept(s, 'ker')) return { label: 'You kept the Ker this year' };
    return { label: 'Join the Ker Puja prayer', run: () => dialog({ name: 'The Galim', role: 'Ker Puja · by the stadium gate' }, [
      'Ker means a boundary. Today the city is sealed, so that the guardian deity can keep out every evil.',
      'No one enters, no one leaves, no tomtom runs until the evening. Even fires are put out. Sit quietly and pray with us.',
    ], () => act({ t: 'fest', id: 'ker' })) };
  } });
  out.push({ ...ROLLER, r: 2, get: () => { const n = Math.floor(S().inv.latex / 3); return n < 1 ? { label: `Sheet roller · 3 cups of latex make a sheet (you have ${S().inv.latex})` } : { label: `Roll ${n} rubber sheet${n > 1 ? 's' : ''}`, run: () => act({ t: 'roll' }) }; } });
  out.push({ x: c.npc.rina.x, z: c.npc.rina.z, r: 2.2, get: () => ({ label: 'Talk to Rina Jamatia', run: () => talkRina(c) }) });
  out.push({ x: c.npc.gopal.x, z: c.npc.gopal.z, r: 2.6, get: () => ({ label: 'Trade with Gopal Saha', run: () => talkGopal(c) }) });
  out.push({ x: c.npc.conductor.x, z: c.npc.conductor.z, r: 2.6, get: () => busPrompt(c) });
  out.push({ x: SPOTS.pandal[0], z: SPOTS.pandal[1], r: 6, get: () => {
    const s = S(); const m = currentMission(s);
    if (m?.id !== 'durga') {
      if (isFestival(s.day, 'durga') && !kept(s, 'durga')) return s.hour < 18 && s.hour >= 5 ? { label: 'Durga Puja · the pandal lights come on after 18:00' } : { label: 'Join this year\'s Durga Puja', run: () => act({ t: 'fest', id: 'durga' }) };
      return { label: s.flags.durga ? 'The Modern Club pandal' : 'Modern Club · its Durga Puja draws all of Agartala' };
    }
    if (s.hour < 18 && s.hour >= 5) return { label: 'The pandal lights come on after dark · come back after 18:00' };
    return { label: 'Join the Durga Puja', run: () => act({ t: 'durga' }) };
  } });
  for (const n of c.neighbours) out.push({ x: n.x, z: n.z, r: 2.4, get: () => {
    const s = S(); const k = kaamFor(s, n.id); const d = deliveryFor(s, n.id);
    const label = d?.kind === 'drop' ? `Give ${n.name} the parcel` : d?.kind === 'pick' ? `Talk to ${n.name} · has a parcel to send` : k && !k.done ? `Talk to ${n.name} · needs ${k.qty} ${k.itemName}` : `Talk to ${n.name}`;
    return { label, run: () => talkNeighbour(c, n) };
  } });
  for (const sight of SIGHTS) out.push({ x: sight.x, z: sight.z, r: 9, get: () => {
    const seen = S().visited.includes(sight.id); const s = S();
    if (sight.id === 'kalibari' && isFestival(s.day, 'diwali') && !kept(s, 'diwali')) {
      if (s.hour < 18 && s.hour >= 5) return { label: 'Diwali · lamps are floated on the lake after dark' };
      return { label: `Float a diya on the lake · ₹${PRICES.lamp}`, run: () => act({ t: 'fest', id: 'diwali' }) };
    }
    return { label: seen ? `${sight.name} · seen` : `See ${sight.name} · +₹${SIGHT_REWARD}`, run: () => dialog({ name: sight.name, role: seen ? 'A place you have seen' : `Sight ${S().visited.length + 1} of ${SIGHTS.length}` }, [sight.lore], seen ? undefined : () => c.game.dispatch({ t: 'visit', id: sight.id })) };
  } });
  return out;
}

/** Things that move with the house, and the tomtom stands in play. Rebuilt every frame (cheap). */
export function dynamicSpots(c: Ctx): Spot[] {
  const S = () => c.game.S; const bed = c.home.bed;
  const out: Spot[] = [
    { ...bed, r: 2.2, get: () => (isNight(S()) ? { label: 'Sleep till morning', run: c.sleep } : { label: 'Your gairing · you can sleep here after 19:00' }) },
    { x: c.npc.grandpa.x, z: c.npc.grandpa.z, r: 2.2, get: () => ({ label: nextChapter(S()) && S().flags.metGrandpa ? 'Talk to Grandpa Hemanta · he has a story for you' : 'Talk to Grandpa Hemanta', run: () => talkGrandpa(c) }) },
    { ...c.home.kitchen, r: 1.8, get: () => { const s = S(); return s.inv.paddy >= 1 ? { label: `Cook pitha · 1 paddy and ₹${PRICES.jaggery} of jaggery make 4${pithaSeason(s.day) ? ' · it is pitha season' : ''}`, run: () => c.game.dispatch({ t: 'cook' }) } : { label: 'The chula · cook pitha from 1 sack of paddy' }; } },
  ];
  for (const st of standsFor(S().home)) out.push({ x: st.x, z: st.z, r: 2.8, get: () => (kerClosed(S()) ? { label: 'Ker Puja: no tomtoms run until 18:00' } : { label: S().flags.freeRide ? `Take a tomtom from ${st.name} · first ride on Grandpa` : `Take a tomtom from ${st.name} · ₹${PRICES.fare}`, run: () => openRide(S(), st, (to) => c.ride(st, to)) }) });
  return out;
}

/** Whether a neighbour has a parcel to hand you, or is waiting for the one you carry. */
export function deliveryFor(s: GameState, npc: string): { kind: 'pick' | 'drop'; d: NonNullable<ReturnType<typeof deliveryById>> } | null {
  if (s.carry) { const d = deliveryById(s.carry); return d && d.to === npc ? { kind: 'drop', d } : null; }
  const d = dailyDeliveries(s.day).find((x) => x.from === npc && !s.delivered.includes(x.id));
  return d ? { kind: 'pick', d } : null;
}
const nameOf = (id: string) => NEIGHBOURS.find((n) => n.id === id);

/** Picks the thing you are facing, or water if you are standing at the edge of a pond. */
export function findTarget(c: Ctx, spots: Spot[]): (Spot & { water?: boolean }) | null {
  const p = c.player(); const fx = Math.sin(p.face), fz = Math.cos(p.face);
  let best: Spot | null = null, bd = 1e9;
  for (const it of [...dynamicSpots(c), ...spots]) {
    const d = Math.hypot(p.x - it.x, p.z - it.z); if (d >= it.r + 0.8) continue;
    const score = d - (((it.x - p.x) * fx + (it.z - p.z) * fz) / (d || 1)) * 0.6; if (score < bd) { bd = score; best = it; }
  }
  if (best) return best;
  const w = c.traffic.nearestWalker(p.x + fx * 1.2, p.z + fz * 1.2, 2.2);
  if (w) return { x: w.g.position.x, z: w.g.position.z, r: 1, get: () => ({ label: 'Talk to the passer-by', run: () => {
    c.traffic.hold(w.i, p.x, p.z, 8); const t = passerby(c.game.S, w.i); dialog({ name: t.name, role: 'Passer-by' }, [t.text]);
  } }) };
  for (const r of [1.2, 2.2, 3.2]) {
    const x = p.x + fx * r, z = p.z + fz * r;
    if (c.map.inWater(x, z)) return { x, z, r: 1, water: true, get: () => (c.game.S.inv.water >= c.game.S.canMax ? { label: 'Your can is full' } : { label: 'Fill the watering can', run: () => c.game.dispatch({ t: 'fill' }) }) };
  }
  return null;
}

const GRANDPA_TIPS = [
  'Water in the morning. By noon the sun drinks half of it.',
  'Paddy wants its feet wet, so it goes in the lunga. Pineapple hates standing water, so it goes up on the tilla.',
  'Tap the rubber before the day gets hot. The latex stops running by eleven.',
  'When the sky opens, rest. The rain waters every field at once.',
  'Gopal pays less for pineapple in Asharh and Srabon, when every tilla in Tripura is full of them. Sell in winter if you can wait.',
  'Ujjayanta was built by Maharaja Radha Kishore Manikya. Now it is the State Museum, but on puja nights it still shines like a king lives there.',
  'When I was young there was nothing between these fields and the stadium but paddy and jungle. Now look at the city.',
  'The tomtom wallahs at the stand on our lane will take you anywhere for twenty rupees. Save your legs.',
];
/** Replays one of Grandpa's stories (from the album). */
export function readChapter(_c: Ctx, id: string): void { const ch = chapterById(id); if (ch) dialog({ name: ch.title, role: 'Grandpa\'s album' }, ch.pages); }
function talkGrandpa(c: Ctx): void {
  const s = c.game.S, n = c.npc.grandpa;
  if (s.flags.metGrandpa) { c.game.dispatch({ t: 'chat', npc: 'grandpa' }); const ch = nextChapter(s); if (ch) return dialog({ name: n.name, role: `A story · ${ch.title}` }, ch.pages, () => c.game.dispatch({ t: 'chapter', id: ch.id })); }
  const from = s.from || 'the city';
  if (!s.flags.metGrandpa) return dialog(n, [
    `Khulumkha! You came all the way from ${from}${s.fromKm > 30 ? `, ${s.fromKm.toLocaleString('en-IN')} kilometres` : ''}. Look at you, a ${from} person now.`,
    `I know, I know. Good job in ${from}, good money. But the fields need someone, and you always loved them as a child.`,
    s.home ? `Welcome home to ${s.home.name}. The house is old, but the roof holds and the neighbours are good people.` : 'Welcome home. The house is old, but the roof holds.',
    s.home ? 'Our fields are still down by the Haora, behind the stadium, the last paddy land on this side of the city. There is a tomtom stand on their lane. The lunga has been fallow since my knees gave up.' : 'These fields by the Haora are the last paddy land this side of the city. The river floods them most monsoons, and the silt makes the best paddy in Agartala. The lunga has been fallow since my knees gave up.',
    'Here is a little money and four pouches of paddy seed. But the paddy can wait a day. Garia Puja is close and Rina, by the fields, needs bamboo for the pole. Take the dao, the clumps grow all round the fields.',
  ], () => c.game.dispatch({ t: 'meetGrandpa' }));
  const m = currentMission(s)?.id;
  if (m === 'paddy') return dialog(n, ['Till the lunga, sow, then water every morning. Four plots, and you will see the green come back.', GRANDPA_TIPS[1]]);
  if (m === 'sell') return dialog(n, ['Gopal is at Math Chowmuhani, the other side of the stadium and the lakes, about a kilometre. Take a tomtom from the stand on our lane, it is only twenty rupees.']);
  if (m === 'rubber') return dialog(n, ['Those trees on the back tilla were planted the year you were born. Tap them at dawn and roll the latex at the machine by the house. Three cups make one sheet.']);
  dialog(n, [GRANDPA_TIPS[(s.day + s.mission) % GRANDPA_TIPS.length]]);
}
function talkRina(c: Ctx): void {
  const s = c.game.S, n = c.npc.rina; c.game.dispatch({ t: 'chat', npc: 'rina' });
  if (s.flags.gariaDone && pithaSeason(s.day) && s.inv.pitha > 0 && !s.pithaGiven.includes(`${yearOf(s.day)}:rina`)) return dialog(n, ['Pitha! Patishapta, if I am not wrong. Your grandmother made it just like this.'], () => c.game.dispatch({ t: 'givePitha', npc: 'rina' }));
  if (!s.flags.gariaDone) {
    if (s.inv.bamboo >= 5) return dialog(n, [
      'Five good culms, fresh-cut. That is a proper pole for Garia.',
      'We will raise it here in the courtyard, tie on the flowers and the cotton thread, and the whole para will dance this evening.',
      'And this is for you: a rikutu from my loin loom. The stripes are the ones your grandmother taught me.',
    ], () => c.game.dispatch({ t: 'giveBamboo' }));
    return dialog(n, [`Khulumkha! Garia Puja is close, and the family pole must be fresh bamboo. Bring me five culms. You have ${s.inv.bamboo}.`, 'There are clumps all round your fields, by the pukur and out towards the tilla.']);
  }
  dialog(n, [s.day === s.flags.gariaDay ? 'Can you hear the drums? Come back after four and dance round the pole with us.' : 'This rignai will take me three weeks on the loin loom. Every family has its own stripes. Mine are maroon and black, like my mother\'s.']);
}
function talkNeighbour(c: Ctx, n: NeighbourNpc): void {
  const s = c.game.S; const k = kaamFor(s, n.id); const who = { name: n.name, role: n.role };
  const chat = n.lines[(s.day + n.id.length) % n.lines.length];
  const dv = deliveryFor(s, n.id);
  c.game.dispatch({ t: 'chat', npc: n.id });
  const inv = inviteToday(s);
  if (inv?.npc === n.id && !s.attended.includes(`${s.day}:${n.id}`)) {
    if (s.hour >= INVITE_FROM && s.hour < INVITE_UNTIL) return dialog(who, [`You came! Come in, come in. It is ${inv.what}, and there is far too much food.`, 'Sit with the others. Nobody leaves hungry from this house.'], () => c.game.dispatch({ t: 'attend', npc: n.id }));
    return dialog(who, [chat, `Oh, and you must come this evening. We are having ${inv.what}. After six, here. No excuses!`]);
  }
  if (pithaSeason(s.day) && s.inv.pitha > 0 && !s.pithaGiven.includes(`${yearOf(s.day)}:${n.id}`) && !dv && !(k && !k.done && s.inv[k.item] >= k.qty)) return dialog(who, ['Is that pitha? For me? You should not have. Well, since you did...', 'It is Poush, the season of pitha. My mother made a hundred every Sankranti.'], () => c.game.dispatch({ t: 'givePitha', npc: n.id }));
  if (dv?.kind === 'drop') return dialog(who, [`Ah, ${dv.d.parcel}! I have been waiting all morning.`, `Here, ₹${dv.d.reward} for your trouble. Come and have tea some time.`], () => c.game.dispatch({ t: 'deliver', id: dv.d.id }));
  if (dv?.kind === 'pick') {
    const to = nameOf(dv.d.to);
    return dialog(who, [chat, `Could you take ${dv.d.parcel} to ${to?.name || 'a friend'} ${to ? to.para : ''}? It is ${dv.d.km.toFixed(1)} km. They will pay you ₹${dv.d.reward}.`], () => c.game.dispatch({ t: 'pickup', id: dv.d.id }));
  }
  if (!k) return dialog(who, [chat]);
  if (k.done) return dialog(who, ['Thank you again for today. Come back tomorrow, there is always something.', chat]);
  if (s.inv[k.item] >= k.qty) return dialog(who, [`You brought ${k.qty} ${k.itemName}! That is exactly what I needed ${k.why}.`, `Here, ₹${k.reward}. And tell your grandfather ${n.name} says hello.`], () => c.game.dispatch({ t: 'kaam', npc: n.id }));
  return dialog(who, [chat, `If you can, bring me ${k.qty} ${k.itemName} ${k.why}. I will pay ₹${k.reward}. Today only, mind.`]);
}
function talkGopal(c: Ctx): void {
  const s = c.game.S;
  if (currentMission(s)?.id === 'sell' && s.inv.paddy === 0) return dialog(c.npc.gopal, ['Nomoskar! Bring me paddy and I will give you a fair rate. Fair for me, anyway.'], () => openShop(c.game));
  openShop(c.game);
}
function busPrompt(c: Ctx): Prompt {
  const s = c.game.S;
  if (currentMission(s)?.id === 'kharchi') {
    if (s.inv.paddy < 3 || s.inv.pineapple < 2) return { label: `Kharchi Puja offering · bring 3 paddy and 2 pineapples (you have ${s.inv.paddy} and ${s.inv.pineapple})` };
    if (s.money < PRICES.bus) return { label: `Bus to Old Agartala · ₹${PRICES.bus}, you have ₹${s.money}` };
    return { label: `Take the bus to Old Agartala for Kharchi Puja · ₹${PRICES.bus}`, run: c.kharchiTrip };
  }
  const fair = isFestival(s.day, 'kharchiFair');
  const extra = fair ? { label: `Kharchi Puja fair · Old Agartala · ₹${PRICES.bus} · 3 h`, sub: kept(s, 'kharchiFair') ? 'You went to the fair this year' : festById('kharchiFair')!.how, run: kept(s, 'kharchiFair') || s.money < PRICES.bus ? undefined : c.fair } : undefined;
  return { label: fair ? 'Bus trips · the Kharchi fair bus is running' : 'Bus trips out of the city', run: () => openTrips(c.game, c.trip, extra) };
}

/* ---------- where the golden marker points ---------- */
function nearest<T extends XZ>(list: T[], p: XZ): T | null { let b: T | null = null, bd = 1e9; for (const t of list) { const d = Math.hypot(t.x - p.x, t.z - p.z); if (d < bd) { bd = d; b = t; } } return b; }
const PONDEDGE = { x: POND.x, z: POND.z - POND.d - 1 };
export function missionTarget(s: GameState, p: XZ, spots: Spot[], grandpa: XZ): (XZ & { stand?: boolean }) | null {
  const m = currentMission(s); if (!m) return null;
  const stands = standsFor(s.home);
  const standFor = (t: XZ | null): (XZ & { stand?: boolean }) | null => { if (!t) return null; if (Math.hypot(t.x - p.x, t.z - p.z) > 600) { const st = nearest(stands, p); return st ? { ...st, stand: true } : t; } return t; };
  const plotSpots = (kind: 'lunga' | 'tilla') => PLOTS.map((d, i) => ({ ...d, i, sp: spots[i] })).filter((d) => d.kind === kind && s.plots[d.i].owned && d.sp.get().run);
  const gopal = { x: SPOTS.gopal[0], z: SPOTS.gopal[1] };
  switch (m.id) {
    case 'arrive': { const h = standByKey('stHome', s.home)!; return Math.hypot(h.x - p.x, h.z - p.z) < 40 ? grandpa : standFor(h); }
    case 'home': return standFor(grandpa);
    case 'garia': return s.inv.bamboo >= 5 ? RINA.npc : nearest(BAMBOO.filter((_, i) => s.bamboo[i].ready <= s.day), p) || RINA.npc;
    case 'paddy': { const t = nearest(plotSpots('lunga'), p); if (t && /Water|empty/.test(t.sp.get().label) && s.inv.water < 1) return PONDEDGE; return standFor(t || (s.inv.water < 1 ? PONDEDGE : FIELD)); }
    case 'sell': case 'grow': return standFor(gopal);
    case 'pine': return standFor(nearest(plotSpots('tilla'), p) || HILLS[0]);
    case 'rubber': return standFor(s.inv.latex >= 3 ? ROLLER : (s.hour >= TAP_FROM && s.hour < TAP_UNTIL ? nearest(RUBBER.filter((_, i) => s.trees[i].tapped !== s.day), p) : null) || HILLS[1]);
    case 'kharchi': return standFor({ x: SPOTS.busTerminus[0], z: SPOTS.busTerminus[1] });
    case 'durga': return standFor({ x: SPOTS.pandal[0], z: SPOTS.pandal[1] });
  }
  return null;
}
