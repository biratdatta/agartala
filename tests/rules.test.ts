import { describe, expect, it } from 'vitest';
import { NEED, PRICES } from '../src/shared/constants.js';
import { price } from '../src/shared/economy.js';
import { apply } from '../src/shared/rules.js';
import { newState, normalize } from '../src/shared/save.js';
import { advance } from '../src/shared/time.js';
import { T0, game, msFor } from './helpers.js';

describe('farming', () => {
  it('tills, sows, waters, grows and harvests paddy', () => {
    const g = game(); g.s.inv.paddySeed = 1; g.s.inv.water = 0;
    g.ok({ t: 'till', plot: 0 });
    expect(g.do({ t: 'till', plot: 0 }).ok).toBe(false);
    g.ok({ t: 'sow', plot: 0 });
    expect(g.s.plots[0].crop).toBe('paddy');
    expect(g.do({ t: 'water', plot: 0 }).ok).toBe(false); // can is empty
    g.ok({ t: 'fill' }); g.ok({ t: 'water', plot: 0 });
    g.wait(10); g.do({ t: 'fill' });
    expect(g.s.plots[0].growth).toBeCloseTo(10, 0);
    expect(g.do({ t: 'harvest', plot: 0 }).ok).toBe(false);
  });

  it('grows only on watered days', () => {
    const g = game(); g.s.inv.paddySeed = 1; g.s.inv.water = 8;
    g.ok({ t: 'till', plot: 0 }); g.ok({ t: 'sow', plot: 0 });
    g.wait(5);
    if (!g.s.rain) { g.do({ t: 'fill' }); expect(g.s.plots[0].growth).toBe(0); }
  });

  it('will not sow paddy on an unowned plot or pineapple without suckers', () => {
    const g = game(); g.s.inv.paddySeed = 5;
    expect(g.do({ t: 'till', plot: 11 }).ok).toBe(false); // plots 6..11 start unowned
    g.ok({ t: 'till', plot: 12 }); // tilla bed
    expect(g.do({ t: 'sow', plot: 12 }).ok).toBe(false);
  });

  it('harvests a ripe crop for the right yield', () => {
    const g = game(); g.s.plots[0] = { state: 'tilled', crop: 'paddy', growth: NEED.paddy, watered: true, owned: true };
    g.ok({ t: 'harvest', plot: 0 });
    expect(g.s.inv.paddy).toBe(2); expect(g.s.stats.harvest.paddy).toBe(1); expect(g.s.plots[0].crop).toBeNull();
  });
});

describe('rubber, bamboo, jackfruit', () => {
  it('taps only at dawn, once a day, and rolls 3 cups into a sheet', () => {
    const g = game();
    g.at(12); expect(g.do({ t: 'tap', tree: 0 }).ok).toBe(false);
    g.at(6); g.ok({ t: 'tap', tree: 0 }); expect(g.do({ t: 'tap', tree: 0 }).ok).toBe(false);
    g.ok({ t: 'tap', tree: 1 }); expect(g.do({ t: 'roll' }).ok).toBe(false);
    g.ok({ t: 'tap', tree: 2 }); g.ok({ t: 'roll' });
    expect(g.s.inv.sheet).toBe(1); expect(g.s.inv.latex).toBe(0);
  });
  it('bamboo regrows in two days', () => {
    const g = game(); g.ok({ t: 'cut', clump: 0 });
    expect(g.do({ t: 'cut', clump: 0 }).ok).toBe(false);
    g.wait(48); g.ok({ t: 'cut', clump: 0 });
    expect(g.s.inv.bamboo).toBe(2);
  });
});

describe('market', () => {
  it('sells at the day\'s rate and refuses to sell what you do not have', () => {
    const g = game(); g.s.inv.paddy = 3; const p = price('paddy', g.s.day);
    g.ok({ t: 'sell', item: 'paddy', n: 2 });
    expect(g.s.money).toBe(100 + 2 * p);
    expect(g.do({ t: 'sell', item: 'paddy', n: 5 }).ok).toBe(false);
    expect(g.do({ t: 'sell', item: 'paddy', n: -1 }).ok).toBe(false);
    expect(g.do({ t: 'sell', item: 'gold' as 'paddy', n: 1 }).ok).toBe(false);
  });
  it('buys land, a bhar and a bicycle once', () => {
    const g = game(); g.s.money = 5000;
    g.ok({ t: 'buy', item: 'plot' }); expect(g.s.plots[6].owned).toBe(true);
    g.ok({ t: 'buy', item: 'bhar' }); expect(g.s.canMax).toBe(16); expect(g.do({ t: 'buy', item: 'bhar' }).ok).toBe(false);
    g.ok({ t: 'buy', item: 'cycle' }); expect(g.do({ t: 'buy', item: 'cycle' }).ok).toBe(false);
    expect(g.s.money).toBe(5000 - PRICES.plot - PRICES.bhar - PRICES.cycle);
  });
  it('gives the first tomtom ride free, then charges, and counts ride time only while riding', () => {
    const g = game();
    g.ok({ t: 'ride', from: 'stCircuit', to: 'stHome' });
    expect(g.s.money).toBe(100); expect(g.s.ride).not.toBeNull();
    expect(g.do({ t: 'ride', from: 'stHome', to: 'stLake' }).ok).toBe(false); // already riding
    const g2 = game(); g2.ok({ t: 'ride', from: 'stCircuit', to: 'stHome' });
    expect(g2.s.ride).not.toBeNull();
    // skip: arrive books the rest of the ride time and drops you at the stand
    g2.ok({ t: 'arrive' });
    expect(g2.s.ride).toBeNull(); expect(g2.s.flags.arrived).toBe(true); expect(g2.s.mission).toBe(1);
    g2.ok({ t: 'ride', from: 'stHome', to: 'stLake' });
    expect(g2.s.money).toBe(100 - PRICES.fare);
    expect(g2.do({ t: 'ride', from: 'stHome', to: 'nowhere' }).ok).toBe(false);
  });
  it('finishes a ride on its own when the time is up', () => {
    const g = game(); g.ok({ t: 'ride', from: 'stCircuit', to: 'stHome' });
    const ms = g.s.ride!.ms; const before = g.s.hour;
    g.wait((ms / 1000 / 300) * 24 * 3); g.do({ t: 'fill' });
    expect(g.s.ride).toBeNull(); expect(g.s.pos.x).toBeCloseTo(-700, 0); expect(g.s.hour).toBeGreaterThan(before);
  });
});

describe('kaam', () => {
  it('pays for a neighbour\'s request once a day', async () => {
    const { dailyKaam } = await import('../src/shared/kaam.js');
    const g = game(); const k = dailyKaam(g.s.day)[0];
    expect(g.do({ t: 'kaam', npc: k.npc }).ok).toBe(false);
    g.s.inv[k.item] = k.qty;
    g.ok({ t: 'kaam', npc: k.npc });
    expect(g.s.money).toBe(100 + k.reward); expect(g.s.inv[k.item]).toBe(0);
    g.s.inv[k.item] = k.qty; expect(g.do({ t: 'kaam', npc: k.npc }).ok).toBe(false);
    expect(dailyKaam(5)).toEqual(dailyKaam(5)); expect(dailyKaam(5)).toHaveLength(5);
  });
  it('stores a cleaned hometown', () => {
    const g = game(); g.ok({ t: 'from', city: 'Bengaluru <b>', km: 2340.4 });
    expect(g.s.from).toBe('Bengaluru b'); expect(g.s.fromKm).toBe(2340);
  });
});

describe('time', () => {
  it('only lets you sleep at night and wakes you at 06:00 the next day', () => {
    const g = game(); expect(g.do({ t: 'sleep' }).ok).toBe(false);
    g.at(21); const d = g.s.day; g.ok({ t: 'sleep' });
    expect(g.s.day).toBe(d + 1); expect(g.s.hour).toBe(6);
  });
  it('caps offline catch-up at a week', () => {
    const s = newState(T0); advance(s, T0 + msFor(24 * 100));
    expect(s.day).toBeLessThanOrEqual(8);
  });
  it('never runs the clock backwards', () => {
    const s = newState(T0); advance(s, T0 - 1e6); expect(s.day).toBe(1); expect(s.hour).toBe(6.5);
  });
});

describe('tamper resistance', () => {
  it('ignores junk actions', () => {
    const s = newState(T0);
    for (const a of [null, {}, { t: 'give', money: 1e6 }, { t: 'harvest', plot: 999 }, { t: 'tap', tree: 'x' }]) {
      expect(apply(s, a as never, T0).ok).toBe(false);
    }
    expect(s.money).toBe(100);
  });
  it('normalize clamps a hand-edited save', () => {
    const s = normalize({ money: -50, canMax: 9999, inv: { paddy: 'lots' }, hour: 99 }, T0);
    expect(s.money).toBe(0); expect(s.canMax).toBe(8); expect(s.inv.paddy).toBe(0); expect(s.hour).toBeLessThan(24);
  });
  it('festival actions need their mission', () => {
    const g = game(); g.s.inv.paddy = 3; g.s.inv.pineapple = 2;
    expect(g.do({ t: 'kharchi' }).ok).toBe(false);
    g.at(20); expect(g.do({ t: 'durga' }).ok).toBe(false);
  });
});

describe('home anywhere in Agartala', () => {
  it('moves the Home tomtom stand with the house, and arrival follows it', async () => {
    const { standByKey } = await import('../src/shared/stands.js');
    const g = game();
    g.ok({ t: 'home', site: { name: 'Krishnanagar', x: -730, z: -160, sx: -735, sz: -150, face: 0 } });
    expect(g.s.home?.name).toBe('Krishnanagar');
    expect(standByKey('stHome', g.s.home)?.x).toBe(-735);
    expect(standByKey('stFields', g.s.home)).toBeDefined();
    g.ok({ t: 'ride', from: 'stCircuit', to: 'stHome' }); g.ok({ t: 'arrive' });
    expect(g.s.pos.x).toBe(-735); expect(g.s.flags.arrived).toBe(true);
    expect(g.do({ t: 'home', site: { name: 'Mars', x: 99999, z: 0, sx: 0, sz: 0, face: 0 } }).ok).toBe(false);
    g.ok({ t: 'home', site: null }); expect(g.s.home).toBeNull();
  });
});

describe('errands', () => {
  it('carries one parcel at a time and pays on delivery', async () => {
    const { dailyDeliveries } = await import('../src/shared/errands.js');
    const g = game(); const [d1, d2] = dailyDeliveries(g.s.day);
    expect(g.do({ t: 'deliver', id: d1.id }).ok).toBe(false);
    g.ok({ t: 'pickup', id: d1.id });
    expect(g.do({ t: 'pickup', id: d2.id }).ok).toBe(false); // hands full
    g.ok({ t: 'deliver', id: d1.id });
    expect(g.s.money).toBe(100 + d1.reward); expect(g.s.carry).toBeNull();
    expect(g.do({ t: 'pickup', id: d1.id }).ok).toBe(false); // already done
    expect(g.do({ t: 'pickup', id: '1:fake>parcel' }).ok).toBe(false);
  });
  it('pays once for each sight', async () => {
    const { SIGHTS, SIGHT_REWARD } = await import('../src/shared/errands.js');
    const g = game(); g.ok({ t: 'visit', id: SIGHTS[0].id });
    expect(g.s.money).toBe(100 + SIGHT_REWARD); expect(g.do({ t: 'visit', id: SIGHTS[0].id }).ok).toBe(false);
    expect(g.do({ t: 'visit', id: 'moon' }).ok).toBe(false);
  });
});
