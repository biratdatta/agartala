import { describe, expect, it } from 'vitest';
import { NEED } from '../src/shared/constants.js';
import { MISSIONS, currentMission } from '../src/shared/missions.js';
import type { Action } from '../src/shared/rules.js';
import { game } from './helpers.js';

/** Plays the whole story through the rules alone, the way a real player would. */
describe('story', () => {
  it('plays all nine missions to the end', () => {
    const g = game(); const s = g.s;
    const tryDo = (a: Action) => g.do(a).ok;
    const farmDay = () => {
      g.ok({ t: 'pos', x: 0, z: 0, face: 0 });
      if (s.inv.water < s.canMax) tryDo({ t: 'fill' });
      s.plots.forEach((p, i) => {
        if (!p.owned) return;
        if (p.crop && p.growth >= NEED[p.crop]) tryDo({ t: 'harvest', plot: i });
        if (p.state === 'grass') tryDo({ t: 'till', plot: i });
        if (!p.crop) tryDo({ t: 'sow', plot: i });
        if (p.crop && !p.watered) { if (!s.inv.water) tryDo({ t: 'fill' }); tryDo({ t: 'water', plot: i }); }
      });
      s.bamboo.forEach((_, i) => tryDo({ t: 'cut', clump: i }));
      s.jack.forEach((_, i) => tryDo({ t: 'pick', tree: i }));
    };
    const visitGopal = () => {
      const keep = currentMission(s)?.id === 'kharchi' ? { paddy: 3, pineapple: 2 } : { paddy: 0, pineapple: 0 };
      if (s.inv.paddy > keep.paddy) g.ok({ t: 'sell', item: 'paddy', n: s.inv.paddy - keep.paddy });
      if (s.inv.pineapple > keep.pineapple) g.ok({ t: 'sell', item: 'pineapple', n: s.inv.pineapple - keep.pineapple });
      for (const k of ['sheet', 'jackfruit'] as const) if (s.inv[k]) g.ok({ t: 'sell', item: k, n: s.inv[k] });
      if (s.flags.gariaDone && s.inv.bamboo) g.ok({ t: 'sell', item: 'bamboo', n: s.inv.bamboo });
      while (s.inv.paddySeed < 8 && s.money >= 15) g.ok({ t: 'buy', item: 'paddySeed' });
      while (s.inv.sucker < 6 && s.money >= 10) g.ok({ t: 'buy', item: 'sucker' });
      if (currentMission(s)?.id === 'grow') while (s.plots.slice(0, 12).filter((p) => p.owned).length < 8 && s.money >= 400) g.ok({ t: 'buy', item: 'plot' });
    };
    g.ok({ t: 'meetGrandpa' });
    for (let day = 0; day < 60 && currentMission(s); day++) {
      g.at(6);
      s.trees.forEach((_, i) => tryDo({ t: 'tap', tree: i }));
      tryDo({ t: 'roll' });
      farmDay();
      if (s.inv.bamboo >= 5 && !s.flags.gariaDone) g.ok({ t: 'giveBamboo' });
      g.at(14); farmDay(); visitGopal();
      if (currentMission(s)?.id === 'kharchi' && s.inv.paddy >= 3 && s.inv.pineapple >= 2) g.ok({ t: 'kharchi' });
      g.at(20);
      if (currentMission(s)?.id === 'durga') g.ok({ t: 'durga' });
      if (currentMission(s)) g.ok({ t: 'sleep' });
    }
    expect(s.mission).toBe(MISSIONS.length);
    expect(s.ended).toBe(true);
    expect(s.flags.blessed).toBe(true);
  });
});
