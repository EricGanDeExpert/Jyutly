/** Dynamic time warping between a learner contour and the reference. */

export type WarpPath = Array<[number, number]>;

const STEP_PENALTY = 0.02;

export function dtw(a: number[], b: number[]): WarpPath {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return [];
  const INF = Number.POSITIVE_INFINITY;
  const cost = new Float64Array((n + 1) * (m + 1)).fill(INF);
  const dir = new Uint8Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => i * (m + 1) + j;
  cost[at(0, 0)] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const c = Math.abs((a[i - 1] as number) - (b[j - 1] as number));
      const diag = cost[at(i - 1, j - 1)] as number;
      const up = (cost[at(i - 1, j)] as number) + STEP_PENALTY;
      const left = (cost[at(i, j - 1)] as number) + STEP_PENALTY;
      if (diag <= up && diag <= left) {
        cost[at(i, j)] = diag + c;
        dir[at(i, j)] = 0;
      } else if (up <= left) {
        cost[at(i, j)] = up + c;
        dir[at(i, j)] = 1;
      } else {
        cost[at(i, j)] = left + c;
        dir[at(i, j)] = 2;
      }
    }
  }
  const path: WarpPath = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    path.push([i - 1, j - 1]);
    const d = dir[at(i, j)];
    if (d === 0) {
      i--;
      j--;
    } else if (d === 1) i--;
    else j--;
  }
  return path.reverse();
}

/** Learner index range [start,end] that aligns with reference frames [refStart, refEnd). */
export function mapSegment(
  path: WarpPath,
  refStart: number,
  refEnd: number,
): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const [i, j] of path) {
    if (j >= refStart && j < refEnd) {
      lo = Math.min(lo, i);
      hi = Math.max(hi, i);
    }
  }
  return lo <= hi ? [lo, hi] : null;
}
