import { describe, expect, it } from 'vitest';
import { AGAR_NEED, ENERGY_MAX, FISH_NEED, PRICES, TEA_NEED } from '../src/shared/constants.js';
import { demandOf, haatPrice, priceAt, saleValue } from '../src/shared/economy.js';
import { FESTIVALS, festivalsOn, kerClosed } from '../src/shared/festivals.js';
import { FRIEND_AT, PHRASES, inviteToday } from '../src/shared/friends.js';
import { NEIGHBOURS, dailyKaam } from '../src/shared/kaam.js';
import { normalize } from '../src/shared/save.js';
import { CHAPTERS, nextChapter } from '../src/shared/story.js';
import { TRIPS } from '../src/shared/trips.js';
import { weekId } from '../src/shared/week.js';
import { inArea } from '../src/shared/area.js';
import { T0, game } from './helpers.js';

const dayOf = (month: number, d: number) => month * 4 + d; // first year
const at = (g: ReturnType<typeof game>, day: number, hour: number) => { while (g.s.day < day) { g.at(23.9); g.at(0.1); } g.at(hour); };

describe('the bazar moves', () => {
  it('slides the rate as you sell and recovers over the following days', () => {
    const g = game(); g.s.inv.pineapple = 30; g.at(9);
    const first = priceAt('pineapple', g.s.day, 0);
    g.ok({ t: 'sell', item: 'pineapple', n: 10 });
    expect(priceAt('pineapple', g.s.day, g.s.market.pineapple!)).toBeLessThan(first);
    expect(saleValue('pineapple', g.s.day, 0, 10)).toBeLessThan(first * 10);
    const p = g.s.market.pineapple!; g.at(23.9); g.at(9);
    expect(g.s.market.pineapple!).toBeLessThan(p);
  });
  it('names one item in demand each day, and pays the haat premium', () => {
    expect(demandOf(7)).toBe(demandOf(7));
    const seen = new Set(Array.from({ length: 40 }, (_, d) => demandOf(d + 1))); expect(seen.size).toBeGreaterThan(3);
    expect(haatPrice('pineapple', 30)).toBeGreaterThan(0);
  });
  it('shuts at night', () => {
    const g = game(); g.s.inv.paddy = 1; g.at(23); expect(g.do({ t: 'sell', item: 'paddy', n: 1 }).ok).toBe(false);
  });
});

describe('energy and food', () => {
  it('tires you, and food and sleep bring you back', () => {
    const g = game(); g.s.energy = 2; g.s.inv.paddySeed = 1;
    expect(g.do({ t: 'till', plot: 0 }).ok).toBe(false);
    g.at(12); g.s.energy = 10; g.ok({ t: 'eat', stall: 'fBattala', dish: 'momo' });
    expect(g.s.energy).toBe(32); expect(g.s.money).toBe(100 - 30);
    expect(g.do({ t: 'eat', stall: 'fBattala', dish: 'bhaat' }).ok).toBe(false); // not on this menu
    g.ok({ t: 'till', plot: 0 }); expect(g.s.energy).toBe(29);
    g.at(21); g.ok({ t: 'sleep' }); expect(g.s.energy).toBe(ENERGY_MAX);
    g.at(23.5); expect(g.do({ t: 'eat', stall: 'fLake', dish: 'cha' }).ok).toBe(false); // shut
  });
  it('comes back slowly with rest', () => {
    const g = game(); g.s.energy = 10; g.wait(4); g.do({ t: 'fill' }); expect(g.s.energy).toBeCloseTo(20, 0);
  });
});

describe('new crops, the pond and the pump', () => {
  it('plants tea once and plucks it every morning', () => {
    const g = game(); g.s.money = 1000; g.ok({ t: 'buy', item: 'teaSapling' });
    g.ok({ t: 'plant', kind: 'tea', i: 0 }); expect(g.do({ t: 'pluck', i: 0 }).ok).toBe(false);
    g.s.tea[0].growth = TEA_NEED; g.at(8); g.ok({ t: 'pluck', i: 0 }); expect(g.s.inv.tea).toBe(2);
    expect(g.do({ t: 'pluck', i: 0 }).ok).toBe(false);
    g.at(7); g.ok({ t: 'pluck', i: 0 }); expect(g.s.inv.tea).toBe(4);
  });
  it('grows agar for a month, then fells it for agarwood', () => {
    const g = game(); g.s.inv.agarSapling = 1; g.ok({ t: 'plant', kind: 'agar', i: 0 });
    expect(g.do({ t: 'fell', i: 0 }).ok).toBe(false);
    g.s.agar[0].growth = AGAR_NEED - 1; g.wait(1.5); g.ok({ t: 'fell', i: 0 });
    expect(g.s.inv.agar).toBe(2); expect(g.s.agar[0].planted).toBe(false);
  });
  it('stocks the pukur and nets fish three days later', () => {
    const g = game(); g.s.money = 500; g.ok({ t: 'buy', item: 'fingerling' }); g.ok({ t: 'stock' });
    expect(g.do({ t: 'net' }).ok).toBe(false);
    g.s.pond.growth = FISH_NEED; g.ok({ t: 'net' }); expect(g.s.inv.fish).toBe(6);
  });
  it('runs the pump once a day to water every crop', () => {
    const g = game(); g.s.money = 5000; g.s.inv.paddySeed = 3;
    for (const i of [0, 1, 2]) { g.ok({ t: 'till', plot: i }); g.ok({ t: 'sow', plot: i }); g.s.plots[i].watered = false; }
    expect(g.do({ t: 'pump' }).ok).toBe(false);
    g.ok({ t: 'buy', item: 'pump' }); g.ok({ t: 'pump' });
    expect(g.s.plots.slice(0, 3).every((p) => p.watered)).toBe(true);
    g.s.plots[0].watered = false; expect(g.do({ t: 'pump' }).ok).toBe(false);
  });
  it('makes baskets from bamboo and pitha from paddy', () => {
    const g = game(); g.s.inv.bamboo = 3; g.s.inv.paddy = 1;
    g.ok({ t: 'craft' }); expect(g.s.inv.basket).toBe(1); expect(g.do({ t: 'craft' }).ok).toBe(false);
    g.ok({ t: 'cook' }); expect(g.s.inv.pitha).toBe(4); expect(g.s.money).toBe(100 - PRICES.jaggery);
  });
});

describe('seasons', () => {
  it('lets fruit go off overnight unless you have a cold store', () => {
    const g = game(); g.s.inv.pineapple = 20; g.s.inv.fish = 8; g.at(23.9); g.at(6);
    expect(g.s.inv.pineapple).toBe(18); expect(g.s.inv.fish).toBe(6);
    g.s.coldStore = true; g.at(23.9); g.at(6); expect(g.s.inv.pineapple).toBe(18);
  });
  it('a hired hand waters every crop at dawn', () => {
    const g = game(); g.s.money = 1000; g.s.inv.paddySeed = 2;
    g.ok({ t: 'till', plot: 0 }); g.ok({ t: 'sow', plot: 0 }); g.ok({ t: 'buy', item: 'helper' });
    expect(g.s.helperUntil).toBe(8);
    g.at(23.9); g.at(6); expect(g.s.plots[0].watered).toBe(true);
  });
  it('floods the lunga in the monsoon: no tilling, slower rides, faster paddy', () => {
    let day = 9; const s = game().s; // find a flood day in Asharh/Srabon
    for (; day < 17; day++) { const g = game(); at(g, day, 8); if (g.s.flood) break; }
    expect(day).toBeLessThan(17);
    const g = game(); at(g, day, 8); g.s.flags.freeRide = false;
    expect(g.do({ t: 'till', plot: 0 }).ok).toBe(false);
    g.ok({ t: 'ride', from: 'stHome', to: 'stMath' });
    const dry = game(); dry.s.flags.freeRide = false; dry.ok({ t: 'ride', from: 'stHome', to: 'stMath' });
    expect(g.s.ride!.ms).toBeGreaterThan(dry.s.ride!.ms); void s;
  });
});

describe('festivals', () => {
  it('has a calendar', () => {
    expect(festivalsOn(dayOf(6, 3)).map((f) => f.id)).toContain('diwali');
    expect(FESTIVALS.length).toBe(5);
  });
  it('closes the city for Ker Puja', () => {
    const g = game(); at(g, dayOf(3, 3), 9); expect(kerClosed(g.s)).toBe(true);
    g.s.flags.freeRide = false; expect(g.do({ t: 'ride', from: 'stHome', to: 'stMath' }).ok).toBe(false);
    g.ok({ t: 'fest', id: 'ker' }); expect(g.do({ t: 'fest', id: 'ker' }).ok).toBe(false);
  });
  it('floats a lamp on Diwali night only', () => {
    const g = game(); at(g, dayOf(6, 3), 12); expect(g.do({ t: 'fest', id: 'diwali' }).ok).toBe(false);
    g.at(19); const m = g.s.money; g.ok({ t: 'fest', id: 'diwali' }); expect(g.s.money).toBe(m - PRICES.lamp + 80);
    const h = game(); at(h, dayOf(6, 1), 19); expect(h.do({ t: 'fest', id: 'diwali' }).ok).toBe(false);
  });
  it('rewards three plates of pitha at Pous Sankranti', () => {
    const g = game(); at(g, dayOf(8, 3), 10); g.s.inv.pitha = 3; const m = g.s.money;
    g.ok({ t: 'givePitha', npc: 'nShiva' }); expect(g.do({ t: 'givePitha', npc: 'nShiva' }).ok).toBe(false);
    g.ok({ t: 'givePitha', npc: 'rina' }); g.ok({ t: 'givePitha', npc: 'nBhati' });
    expect(g.s.money).toBe(m + 200); expect(g.s.friends.rina).toBe(15);
  });
  it('gives a prize at the Kharchi fair once a year', () => {
    const g = game(); at(g, dayOf(2, 2), 10); const before = JSON.stringify(g.s.inv) + g.s.money;
    g.ok({ t: 'fest', id: 'kharchiFair' }); expect(JSON.stringify(g.s.inv) + g.s.money).not.toBe(before);
    expect(g.do({ t: 'fest', id: 'kharchiFair' }).ok).toBe(false);
  });
});

describe('trips', () => {
  it('runs four trips with their own rules', () => {
    expect(TRIPS.map((t) => t.id)).toEqual(['neermahal', 'sundari', 'akhaura', 'haat']);
    const g = game(); g.s.money = 1000; g.s.energy = 20; g.at(8);
    expect(g.do({ t: 'trip', id: 'akhaura' }).ok).toBe(false); // only at sunset
    g.ok({ t: 'trip', id: 'neermahal' }); expect(g.s.energy).toBe(ENERGY_MAX); expect(g.s.trips).toContain('neermahal');
    g.at(16); g.ok({ t: 'trip', id: 'akhaura' });
    g.at(7); g.ok({ t: 'trip', id: 'sundari' }); expect(g.s.boostUntil).toBe(g.s.day + 3);
    g.at(7); expect(g.do({ t: 'trip', id: 'sundari' }).ok).toBe(false); // once in 12 days
  });
  it('sells at the border haat on haat day only', () => {
    const g = game(); g.s.money = 100; g.s.inv.pineapple = 5;
    while (g.s.day % 7 !== 2) { g.at(23.9); g.at(0.2); }
    g.at(8); const m = g.s.money;
    expect(g.do({ t: 'trip', id: 'haat', sell: { paddy: 1 } as never }).ok).toBe(false);
    g.ok({ t: 'trip', id: 'haat', sell: { pineapple: 5 } });
    expect(g.s.inv.pineapple).toBe(0); expect(g.s.money).toBe(m - 50 + 5 * haatPrice('pineapple', g.s.day));
  });
});

describe('people', () => {
  it('teaches a phrase a day per person and builds friendship', () => {
    const g = game(); g.ok({ t: 'chat', npc: 'grandpa' }); expect(g.s.phrases).toEqual(['khulumkha']); expect(g.s.money).toBe(110);
    g.ok({ t: 'chat', npc: 'grandpa' }); expect(g.s.phrases).toHaveLength(1); // once a day
    g.ok({ t: 'chat', npc: 'nShiva' }); expect(g.s.friends.nShiva).toBe(2);
    expect(g.do({ t: 'chat', npc: 'nobody' }).ok).toBe(false);
    expect(new Set(PHRASES.map((p) => p.id)).size).toBe(PHRASES.length);
  });
  it('pays friends more for kaam', () => {
    const g = game(); const k = dailyKaam(g.s.day)[0]; g.s.friends[k.npc] = 80; g.s.inv[k.item] = k.qty;
    g.ok({ t: 'kaam', npc: k.npc }); expect(g.s.money - 100).toBeGreaterThan(k.reward);
  });
  it('invites you in the evening once you are friends', () => {
    const g = game(); for (const n of NEIGHBOURS) g.s.friends[n.id] = FRIEND_AT;
    let inv = inviteToday(g.s); while (!inv) { g.at(23.9); g.at(0.2); inv = inviteToday(g.s); }
    g.at(12); expect(g.do({ t: 'attend', npc: inv.npc }).ok).toBe(false);
    g.at(19); g.s.energy = 10; g.ok({ t: 'attend', npc: inv.npc }); expect(g.s.energy).toBeGreaterThan(30);
    expect(g.do({ t: 'attend', npc: inv.npc }).ok).toBe(false);
  });
  it('tells Grandpa\'s stories in order as you earn them', () => {
    const g = game(); expect(nextChapter(g.s)).toBeUndefined();
    g.ok({ t: 'meetGrandpa' }); g.at(23.9); g.at(8);
    expect(nextChapter(g.s)?.id).toBe('house');
    expect(g.do({ t: 'chapter', id: 'rubber' }).ok).toBe(false);
    g.ok({ t: 'chapter', id: 'house' }); expect(g.s.chapters).toEqual(['house']);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(10);
  });
});

describe('weekly boards and saves', () => {
  it('computes ISO weeks', () => {
    expect(weekId(Date.UTC(2026, 9, 8))).toBe('2026-W41');
    expect(weekId(Date.UTC(2027, 0, 1))).toBe('2026-W53');
    expect(weekId(Date.UTC(2024, 11, 30))).toBe('2025-W01');
    expect(weekId(Date.UTC(2021, 0, 3))).toBe('2020-W53');
  });
  it('tallies the week as you go', () => {
    const g = game(); g.s.inv.paddy = 2; g.at(9); g.ok({ t: 'sell', item: 'paddy', n: 2 });
    expect(g.s.week.id).toBe(weekId(g.now)); expect(g.s.week.earned).toBeGreaterThan(0);
  });
  it('upgrades an older save', () => {
    const s = normalize({ v: 4, money: 500, inv: { paddy: 3 }, plots: [] }, T0);
    const moved = normalize({ v: 5, pos: { x: -700, z: -1452, face: 0 }, home: { name: 'Krishnanagar', x: -1730, z: -160, sx: -1735, sz: -150, face: 0 }, ride: { from: 'stCircuit', to: 'stLake', start: T0, ms: 20000, hours: 0.2, done: 0 } }, T0);
    expect(inArea(moved.pos.x, moved.pos.z)).toBe(true); expect(moved.home).toBeNull(); expect(moved.ride).toBeNull();
    expect(s.v).toBe(6); expect(s.energy).toBe(ENERGY_MAX); expect(s.tea).toHaveLength(8); expect(s.inv.tea).toBe(0); expect(s.inv.paddy).toBe(3);
    const bad = normalize({ friends: { '<script>': 5, nShiva: 999 }, energy: -4, market: { paddy: 1e9 } }, T0);
    expect(bad.friends).toEqual({ nShiva: 100 }); expect(bad.energy).toBe(0); expect(bad.market.paddy).toBe(999);
  });
});

describe('vehicles', () => {
  it('starts with Grandpa\'s cycle-rickshaw and sells the rest once', async () => {
    const { owns } = await import('../src/shared/vehicles.js');
    const g = game(); expect(g.s.garage).toEqual(['rickshaw']);
    g.s.money = 50000; g.ok({ t: 'buy', item: 'car' }); expect(owns(g.s, 'car')).toBe(true);
    expect(g.do({ t: 'buy', item: 'car' }).ok).toBe(false);
    g.ok({ t: 'buy', item: 'cycle' }); expect(g.s.cycle).toBe(true);
    expect(g.s.money).toBe(50000 - PRICES.car - PRICES.cycle);
    const old = normalize({ v: 5, cycle: true, scooter: true }, T0); expect(old.garage.sort()).toEqual(['cycle', 'rickshaw', 'scooter']);
  });
  it('pays fares for real passenger trips, not impossible ones', async () => {
    const { FARES_PER_DAY } = await import('../src/shared/vehicles.js');
    const g = game(); g.at(9); const m = g.s.money;
    expect(g.do({ t: 'fare', veh: 'car', from: 'stStadium', to: 'stMath' }).ok).toBe(false); // a car takes no fares
    g.ok({ t: 'fare', veh: 'rickshaw', from: 'stStadium', to: 'stMath' }); expect(g.s.money).toBeGreaterThan(m);
    expect(g.do({ t: 'fare', veh: 'rickshaw', from: 'stMath', to: 'stRamnagar' }).ok).toBe(false); // too fast: no time has passed
    g.wait(4); g.ok({ t: 'fare', veh: 'rickshaw', from: 'stMath', to: 'stRamnagar' });
    expect(g.do({ t: 'fare', veh: 'rickshaw', from: 'stMath', to: 'stMath' }).ok).toBe(false);
    g.s.fares.n = FARES_PER_DAY; g.wait(2); expect(g.do({ t: 'fare', veh: 'rickshaw', from: 'stJoynagar', to: 'stBridge' }).ok).toBe(false);
  });
});

describe('renting', () => {
  it('rents by the hour and charges the rest on return', async () => {
    const { RENT_RATE, rentalCost } = await import('../src/shared/vehicles.js');
    const g = game(); g.s.money = 1000; g.at(8);
    expect(g.do({ t: 'rent', veh: 'car', at: 'stRamnagar' }).ok).toBe(false); // no car at Ramnagar
    g.ok({ t: 'rent', veh: 'scooter', at: 'stStadium' }); expect(g.s.money).toBe(1000 - RENT_RATE.scooter);
    expect(g.do({ t: 'rent', veh: 'cycle', at: 'stMath' }).ok).toBe(false); // one at a time
    g.wait(3); g.do({ t: 'fill' }); expect(rentalCost(g.s)).toBe(Math.ceil(3 * RENT_RATE.scooter));
    expect(g.do({ t: 'returnRental', at: 'nowhere' }).ok).toBe(false);
    const before = g.s.money; g.ok({ t: 'returnRental', at: 'stJoynagar' });
    expect(before - g.s.money).toBe(Math.ceil(3 * RENT_RATE.scooter) - RENT_RATE.scooter); expect(g.s.rental).toBeNull();
    expect(g.do({ t: 'returnRental', at: 'stJoynagar' }).ok).toBe(false);
  });
  it('lets a rented rickshaw carry passengers, and caps a forgotten rental at a day', async () => {
    const { RENT_RATE, RENT_MAX_HOURS, rentalCost } = await import('../src/shared/vehicles.js');
    const g = game(); g.s.money = 5000; g.s.garage = []; g.at(8);
    g.ok({ t: 'rent', veh: 'rickshaw', at: 'stBridge' }); g.wait(1);
    g.ok({ t: 'fare', veh: 'rickshaw', from: 'stBridge', to: 'stRamnagar' });
    g.wait(60); g.do({ t: 'fill' }); expect(rentalCost(g.s)).toBe(RENT_MAX_HOURS * RENT_RATE.rickshaw);
  });
  it('needs money up front, and only rents bicycles during Ker Puja', () => {
    const g = game(); g.s.money = 10; g.at(8); expect(g.do({ t: 'rent', veh: 'car', at: 'stMath' }).ok).toBe(false);
    const k = game(); k.s.money = 1000; while (!(k.s.day === 15)) { k.at(23.9); k.at(0.2); } k.at(9);
    expect(k.do({ t: 'rent', veh: 'bike', at: 'stMath' }).ok).toBe(false); k.ok({ t: 'rent', veh: 'cycle', at: 'stMath' });
  });
});
