// ─── Seeded PRNG (mulberry32) — consistent data across runs ──────────────────

function mulberry32(seed: number): () => number {
  let s = seed;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function rand(min: number, max: number): number {
  return Math.round(min + rng() * (max - min));
}

export function chance(p: number): boolean {
  return rng() < p;
}

// ─── Date helpers ────────────────────────────────────────────────────────────

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}
