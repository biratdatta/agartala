import { describe, expect, it } from 'vitest';
import { currentMission, missionIndex } from '../src/shared/missions.js';
import { PANDALS, PUJO_SEASON } from '../src/shared/pujo.js';
import { newState } from '../src/shared/save.js';
import { game } from './helpers.js';

const IN = PUJO_SEASON.from + 3600e3, OUT = PUJO_SEASON.from - 86400e3;

describe('Durga Puja chapter', () => {
  it('comes after meeting Grandpa in the Puja season, then the story carries on where it was', () => {
    const g = game(newState(IN)); g.s.flags.arrived = true; g.s.flags.metGrandpa = true; g.s.mission = missionIndex('sell');
    expect(currentMission(g.s)?.id).toBe('pujoPandals');
    const before = g.s.money;
    for (const p of PANDALS.slice(0, 5)) g.ok({ t: 'pandal', id: p.id });
    expect(g.do({ t: 'pandal', id: PANDALS[0].id }).ok).toBe(false); // once per pandal
    expect(currentMission(g.s)?.id).toBe('pujoAnjali'); expect(g.s.money).toBe(before + 200);
    g.at(15); expect(g.do({ t: 'anjali' }).ok).toBe(false); // mornings only
    g.at(8); g.ok({ t: 'anjali' }); expect(currentMission(g.s)?.id).toBe('pujoAarti');
    g.at(12); expect(g.do({ t: 'aarti' }).ok).toBe(false);
    g.at(19); g.ok({ t: 'aarti' }); expect(currentMission(g.s)?.id).toBe('pujoBisarjan');
    g.at(16); g.ok({ t: 'bisarjan' });
    expect(currentMission(g.s)?.id).toBe('sell'); expect(g.s.mission).toBe(missionIndex('sell'));
  });
  it('a new player in the season is paid for coming home first, then the Puja begins', () => {
    const g = game(newState(IN)); g.s.flags.arrived = true; g.s.mission = 1; const m0 = g.s.money;
    g.ok({ t: 'meetGrandpa' });
    expect(g.s.money).toBe(m0 + 150); expect(g.s.inv.paddySeed).toBe(4); expect(g.s.mission).toBe(2);
    expect(currentMission(g.s)?.id).toBe('pujoPandals');
  });
  it('waits until you are home, and is not there outside the season', () => {
    const g = game(newState(IN)); expect(currentMission(g.s)?.id).toBe('arrive');
    const out = game(newState(OUT)); out.s.flags.metGrandpa = true; out.s.mission = 2;
    expect(currentMission(out.s)?.id).not.toMatch(/^pujo/); expect(out.do({ t: 'pandal', id: 'modern' }).ok).toBe(false);
  });
});
