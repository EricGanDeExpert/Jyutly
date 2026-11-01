/** Speaker-relative pitch normalization. */

export interface SpeakerRange {
  /** Center of the speaker's range, in semitones re 100 Hz. */
  centerSt: number;
  /** Usable span (p10..p90) in semitones. */
  spanSt: number;
}

export const hzToSt = (hz: number): number => 12 * Math.log2(hz / 100);
export const stToHz = (st: number): number => 100 * Math.pow(2, st / 12);

const MIN_SPAN_ST = 6;

function percentile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return (sorted[lo] as number) + ((sorted[hi] as number) - (sorted[lo] as number)) * (idx - lo);
}

/**
 * Estimate a speaker's range from one or more f0 arrays (0 = unvoiced).
 * Best used on a calibration set (several words); a single level-tone word
 * gives a degenerate span, so the span is clamped.
 */
export function speakerRange(...tracks: number[][]): SpeakerRange {
  const st = tracks
    .flat()
    .filter((f) => f > 0)
    .map(hzToSt)
    .sort((a, b) => a - b);
  if (st.length === 0) return { centerSt: 0, spanSt: 12 };
  const lo = percentile(st, 0.1);
  const hi = percentile(st, 0.9);
  return {
    centerSt: percentile(st, 0.5),
    spanSt: Math.max(hi - lo, MIN_SPAN_ST),
  };
}

/** Hz -> unitless (st - center)/span. Unvoiced frames become NaN. */
export function normalizeContour(f0: number[], range: SpeakerRange): number[] {
  return f0.map((f) => (f > 0 ? (hzToSt(f) - range.centerSt) / range.spanSt : NaN));
}

/** Interpolate interior NaN gaps; trim leading/trailing NaN. Returns offset of first kept frame. */
export function fillAndTrim(c: number[]): { contour: number[]; offset: number } {
  let first = c.findIndex((v) => !Number.isNaN(v));
  if (first < 0) return { contour: [], offset: 0 };
  let last = c.length - 1;
  while (Number.isNaN(c[last] as number)) last--;
  const out = c.slice(first, last + 1);
  for (let i = 0; i < out.length; i++) {
    if (!Number.isNaN(out[i] as number)) continue;
    let j = i;
    while (Number.isNaN(out[j] as number)) j++;
    const a = out[i - 1] as number;
    const b = out[j] as number;
    for (let k = i; k < j; k++) out[k] = a + ((b - a) * (k - i + 1)) / (j - i + 1);
    i = j;
  }
  return { contour: out, offset: first };
}

export function resample(a: number[], n: number): number[] {
  if (a.length === 0) return new Array(n).fill(0);
  if (a.length === 1) return new Array(n).fill(a[0]);
  return Array.from({ length: n }, (_, i) => {
    const x = (i * (a.length - 1)) / (n - 1);
    const lo = Math.floor(x);
    const hi = Math.min(a.length - 1, lo + 1);
    return (a[lo] as number) + ((a[hi] as number) - (a[lo] as number)) * (x - lo);
  });
}
