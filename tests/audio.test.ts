import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('audio wiring', () => {
  it('sends the master volume to the speakers (not back into itself)', () => {
    const src = readFileSync('src/client/audio.ts', 'utf8');
    const out = src.match(/const out = [^\n]+/)![0];
    expect(out).toContain('master.connect(a.destination)');
    expect(out).not.toContain('master.connect(out(');
  });
});
