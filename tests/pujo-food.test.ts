import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CityMap } from '../src/client/map/data.js';
import { stallSpot } from '../src/client/map/stallspot.js';
import { PUJO_STALLS } from '../src/shared/food.js';
import { currentMission, missionIndex } from '../src/shared/missions.js';
import { PANDALS, PUJO_SEASON, pandalById } from '../src/shared/pujo.js';
import { newState } from '../src/shared/save.js';
import { game } from './helpers.js';

const IN = PUJO_SEASON.from + 3600e3;

describe('Puja food and Bijoya', () => {
  it('serves bhog once a day, Puja food late, and mishti to take away', () => {
    const g = game(newState(IN)); g.at(12); g.s.energy = 40; g.s.money = 500;
    g.ok({ t: 'eat', stall: 'pBhog', dish: 'bhog' }); expect(g.s.money).toBe(500); expect(g.s.energy).toBe(70);
    expect(g.do({ t: 'eat', stall: 'pBhog', dish: 'bhog' }).ok).toBe(false); // once a day
    g.at(23); g.ok({ t: 'eat', stall: 'pPhuchka', dish: 'phuchka' }); // open late
    g.ok({ t: 'eat', stall: 'pSweetsR', dish: 'mishti' }); expect(g.s.inv.mishti).toBe(1); expect(g.s.money).toBe(500 - 20 - 80);
    expect(g.do({ t: 'eat', stall: 'pSweetsR', dish: 'phuchka' }).ok).toBe(false); // not on that menu
  });
  it('closes the Puja stalls outside the season', () => {
    const g = game(newState(PUJO_SEASON.from - 86400e3)); g.at(12);
    expect(g.do({ t: 'eat', stall: 'pPhuchka', dish: 'phuchka' }).ok).toBe(false);
  });
  it('ends the Puja chapter with Bijoya visits to three neighbours, with mishti', () => {
    const g = game(newState(IN)); g.s.flags.arrived = true; g.s.flags.metGrandpa = true; g.s.mission = missionIndex('sell');
    g.s.flags.pujoDone = 4; g.s.money = 1000; expect(currentMission(g.s)?.id).toBe('pujoBijoya');
    expect(g.do({ t: 'bijoya', npc: 'nShiva' }).ok).toBe(false); // no mishti yet
    g.at(12); for (let i = 0; i < 3; i++) g.ok({ t: 'eat', stall: 'pSweetsP', dish: 'mishti' });
    for (const n of ['nShiva', 'nSupari', 'nKalibari']) g.ok({ t: 'bijoya', npc: n });
    expect(g.do({ t: 'bijoya', npc: 'nShiva' }).ok).toBe(false);
    expect(g.s.inv.mishti).toBe(0); expect(currentMission(g.s)?.id).toBe('sell');
  });
  it('records when you have seen every pandal', () => {
    const g = game(newState(IN)); for (const p of PANDALS) g.ok({ t: 'pandal', id: p.id });
    expect(g.s.flags.pujoAllAt).toBeGreaterThan(0);
  });
  it('puts every Puja stall whole on open ground near its pandal, clear of the pandal', () => {
    const map = new CityMap(JSON.parse(readFileSync('public/agartala-map.json', 'utf8')));
    const clear = PANDALS.map((p) => ({ x: p.x, z: p.z, r: 13 }));
    for (const st of PUJO_STALLS) {
      const p = pandalById(st.pandal)!; const at = stallSpot(map, p.x, p.z, clear, 44);
      expect(at.ok, st.name).toBe(true); expect(Math.hypot(at.x - p.x, at.z - p.z), st.name).toBeLessThan(45);
    }
  });
});

describe('pandal hoppers board', () => {
  it('puts those who saw every pandal first (earliest first), then the rest by pandals seen', async () => {
    const { MemoryStore } = await import('../api/_lib/store.js'); const st = new MemoryStore();
    const e = (id: string, pandals: number, allAt = '') => st.pujoUpsert({ id, season: '2026', name: id, para: 'Shibnagar', pandals, seen: '', allAt });
    await e('Rina', 5); await e('Bikash', 8, '2026-10-12T10:00:00Z'); await e('Mithu', 8, '2026-10-11T09:00:00Z'); await e('Tapan', 7);
    expect((await st.pujoTop('2026', 10)).map((r) => r.name)).toEqual(['Mithu', 'Bikash', 'Tapan', 'Rina']);
  });
});

describe('pandal sites', () => {
  it('every pandal and the crowd space in front of it are clear of buildings and water', () => {
    const map = new CityMap(JSON.parse(readFileSync('public/agartala-map.json', 'utf8')));
    for (const p of PANDALS) {
      const fx = Math.sin(p.rot), fz = Math.cos(p.rot), ux = Math.cos(p.rot), uz = -Math.sin(p.rot); let hits = 0;
      for (let u = -7.5; u <= 7.5; u += 1.5) for (let v = -6.5; v <= 13; v += 1.5) { const x = p.x + ux * u + fx * v, z = p.z + uz * u + fz * v; if (map.inBuilding(x, z) || map.inWaterPoly(x, z)) hits++; }
      expect(hits, p.name).toBe(0);
    }
  });
});
