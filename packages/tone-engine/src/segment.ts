/** Frame-wise RMS energy envelope (hop in seconds). */
export function frameRms(samples: ArrayLike<number>, sampleRate: number, hopSec = 0.01, frameSec = 0.03): number[] {
  const hopN = Math.round(hopSec * sampleRate);
  const W = Math.round(frameSec * sampleRate);
  const out: number[] = [];
  for (let s = 0; s + W <= samples.length; s += hopN) {
    let acc = 0;
    for (let j = 0; j < W; j++) acc += (samples[s + j] as number) ** 2;
    out.push(Math.sqrt(acc / W));
  }
  return out;
}

/**
 * Split the voiced span into n syllables at the deepest energy dips.
 * Heuristic: used to auto-label reference audio; `ok` is false when we had to
 * fall back to equal splits, so a human should check that word.
 */
export function segmentSyllables(
  rms: number[],
  f0: number[],
  n: number,
): { segments: Array<[number, number]>; ok: boolean } {
  const a = f0.findIndex((f) => f > 0);
  let b = f0.length - 1;
  while (b >= 0 && (f0[b] as number) <= 0) b--;
  if (a < 0 || b <= a) return { segments: [], ok: false };
  if (n <= 1) return { segments: [[a, b + 1]], ok: true };

  const sm = rms.map((_, i) => {
    let s = 0, c = 0;
    for (let k = -2; k <= 2; k++) {
      const v = rms[i + k];
      if (v !== undefined) { s += v; c++; }
    }
    return s / c;
  });
  const MIN_SEP = 6;
  const cands: number[] = [];
  for (let i = a + MIN_SEP; i < b - MIN_SEP; i++) {
    let isMin = true;
    for (let k = -3; k <= 3; k++) if ((sm[i + k] as number) < (sm[i] as number)) isMin = false;
    if (!isMin) continue;
    // must be a real dip: clearly below the peaks on both sides
    let lp = 0, rp = 0;
    for (let k = 1; k <= 15; k++) {
      lp = Math.max(lp, sm[i - k] ?? 0);
      rp = Math.max(rp, sm[i + k] ?? 0);
    }
    if ((sm[i] as number) < 0.8 * Math.min(lp, rp)) cands.push(i);
  }
  cands.sort((x, y) => (sm[x] as number) - (sm[y] as number));
  const picked: number[] = [];
  for (const c of cands) {
    if (picked.length === n - 1) break;
    if (picked.every((p) => Math.abs(p - c) >= MIN_SEP * 2)) picked.push(c);
  }
  let ok = picked.length === n - 1;
  if (!ok) {
    picked.length = 0;
    for (let k = 1; k < n; k++) picked.push(Math.round(a + ((b + 1 - a) * k) / n));
  }
  picked.sort((x, y) => x - y);
  const edges = [a, ...picked, b + 1];
  const segments: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) segments.push([edges[i] as number, edges[i + 1] as number]);
  return { segments, ok };
}
