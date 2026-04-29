// ── Seedable RNG ─────────────────────────────────────────────────────────────
//
// A small reproducible PRNG so tests and sim runs are deterministic when given
// the same seed. Mulberry32 is fine for this: tiny, fast, statistically OK for
// non-cryptographic use.

export interface RNG {
  /** Next float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** True with probability p. */
  bool(p: number): boolean;
  /** Pick a random element. */
  pick<T>(arr: readonly T[]): T;
  /** Weighted pick: weights[i] >= 0, returns index. */
  weighted(weights: readonly number[]): number;
  /** Poisson sample with mean λ (Knuth algorithm). */
  poisson(lambda: number): number;
  /** Normal sample (Box-Muller) with given mean & stddev. */
  normal(mean: number, stddev: number): number;
}

export function makeRng(seed: number): RNG {
  let state = seed >>> 0;
  const next = (): number => {
    state |= 0; state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number) =>
    Math.floor(next() * (max - min + 1)) + min;

  const bool = (p: number) => next() < p;

  const pick = <T>(arr: readonly T[]): T => {
    if (arr.length === 0) throw new Error('pick() on empty array');
    return arr[Math.floor(next() * arr.length)]!;
  };

  const weighted = (weights: readonly number[]): number => {
    const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
    if (total <= 0) return 0;
    let r = next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= Math.max(0, weights[i]!);
      if (r <= 0) return i;
    }
    return weights.length - 1;
  };

  const poisson = (lambda: number): number => {
    if (lambda <= 0) return 0;
    // Knuth — fine for the small λ values (1-10) we use here
    const L = Math.exp(-lambda);
    let k = 0; let p = 1;
    do { k++; p *= next(); } while (p > L);
    return k - 1;
  };

  const normal = (mean: number, stddev: number): number => {
    // Box-Muller
    const u1 = Math.max(next(), 1e-12);
    const u2 = next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stddev;
  };

  return { next, int, bool, pick, weighted, poisson, normal };
}

/** Derive a sub-seed from an existing seed + label, for sub-streams. */
export function derive(seed: number, label: string): number {
  // Simple FNV-1a hash mix
  let h = seed | 0;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
