/** A tiny D1 stand-in over Node's built-in SQLite, so the D1 store runs the real SQL in tests. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { D1Like } from '../api/_lib/env.js';

type Sqlite = typeof import('node:sqlite');
/** node:sqlite ships with Node 22.5+; on older Node the D1 tests are skipped. */
export const sqlite: Sqlite | null = (() => { try { return createRequire(import.meta.url)('node:sqlite') as Sqlite; } catch { return null; } })();

export async function fakeD1(): Promise<D1Like> {
  if (!sqlite) throw new Error('node:sqlite needs Node 22.5+');
  const { DatabaseSync } = sqlite;
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../cloudflare/schema.sql', import.meta.url), 'utf8'));
  return {
    prepare(sql: string) {
      const st = db.prepare(sql);
      return {
        bind(...v: unknown[]) {
          const args = v as (string | number | null)[];
          return {
            async first<T>() { return (st.get(...args) as T) ?? null; },
            async run() { const r = st.run(...args); return { meta: { changes: Number(r.changes) } }; },
            async all<T>() { return { results: st.all(...args) as T[] }; },
          };
        },
      };
    },
  };
}
