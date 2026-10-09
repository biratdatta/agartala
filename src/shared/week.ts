/** ISO-8601 week id ("2026-W41") for a real time in ms, in UTC. Weekly boards reset every Monday. */
export function weekId(ms: number): string {
  const d = new Date(ms); const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thu = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3);
  const y = new Date(thu).getUTCFullYear();
  const firstThu = Date.UTC(y, 0, 4); const fd = (new Date(firstThu).getUTCDay() + 6) % 7;
  const w = 1 + Math.round((thu - (firstThu - fd * 864e5 + 3 * 864e5)) / (7 * 864e5));
  return `${y}-W${String(w).padStart(2, '0')}`;
}
