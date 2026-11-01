/** YIN pitch tracker (de Cheveigné & Kawahara, 2002). Pure TS, runs on-device. */

export interface PitchOptions {
  fminHz?: number;
  fmaxHz?: number;
  frameSec?: number;
  hopSec?: number;
  /** YIN absolute threshold; lower = stricter voicing. */
  threshold?: number;
  /** Frames quieter than this fraction of the loudest frame are unvoiced. */
  silenceRatio?: number;
}

/** f0[i] in Hz, 0 = unvoiced. */
export interface PitchTrack {
  hopSec: number;
  f0: number[];
}

export function detectPitch(
  samples: ArrayLike<number>,
  sampleRate: number,
  opts: PitchOptions = {},
): PitchTrack {
  const fmin = opts.fminHz ?? 70;
  const fmax = opts.fmaxHz ?? 500;
  const hopSec = opts.hopSec ?? 0.01;
  const thr = opts.threshold ?? 0.15;
  const silence = opts.silenceRatio ?? 0.1;
  const W = Math.round((opts.frameSec ?? 0.03) * sampleRate);
  const tauMax = Math.floor(sampleRate / fmin);
  const tauMin = Math.max(2, Math.floor(sampleRate / fmax));
  const hopN = Math.max(1, Math.round(hopSec * sampleRate));
  const need = W + tauMax + 1;
  const n = samples.length;

  const starts: number[] = [];
  for (let s = 0; s + need <= n; s += hopN) starts.push(s);

  const rms = starts.map((s) => {
    let acc = 0;
    for (let j = 0; j < W; j++) {
      const v = samples[s + j] as number;
      acc += v * v;
    }
    return Math.sqrt(acc / W);
  });
  const maxRms = rms.reduce((a, b) => Math.max(a, b), 0);

  const d = new Float64Array(tauMax + 1);
  const cm = new Float64Array(tauMax + 1);
  const f0: number[] = starts.map((s, idx) => {
    if (maxRms === 0 || (rms[idx] as number) < silence * maxRms) return 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      let sum = 0;
      for (let j = 0; j < W; j++) {
        const diff = (samples[s + j] as number) - (samples[s + j + tau] as number);
        sum += diff * diff;
      }
      d[tau] = sum;
    }
    cm[0] = 1;
    let run = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      run += d[tau] as number;
      cm[tau] = run === 0 ? 1 : ((d[tau] as number) * tau) / run;
    }
    let tau = -1;
    for (let t = tauMin; t < tauMax; t++) {
      if ((cm[t] as number) < thr) {
        while (t + 1 < tauMax && (cm[t + 1] as number) < (cm[t] as number)) t++;
        tau = t;
        break;
      }
    }
    if (tau < 0) return 0;
    // parabolic interpolation
    const a = cm[tau - 1] as number;
    const b = cm[tau] as number;
    const c = cm[tau + 1] as number;
    const denom = a - 2 * b + c;
    const shift = denom === 0 ? 0 : (a - c) / (2 * denom);
    const f = sampleRate / (tau + shift);
    return f >= fmin && f <= fmax ? f : 0;
  });

  return { hopSec, f0: cleanTrack(f0) };
}

/** Octave-jump fix, median smoothing, drop voiced runs shorter than 3 frames. */
export function cleanTrack(f0: number[]): number[] {
  const out = f0.slice();
  // octave fix within voiced runs
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1] as number;
    const cur = out[i] as number;
    if (prev > 0 && cur > 0) {
      const r = cur / prev;
      if (r > 1.8 && r < 2.2) out[i] = cur / 2;
      else if (r > 0.45 && r < 0.55) out[i] = cur * 2;
    }
  }
  // median-5 smoothing within voiced runs
  const sm = out.slice();
  for (let i = 0; i < out.length; i++) {
    if ((out[i] as number) === 0) continue;
    const win: number[] = [];
    for (let k = -2; k <= 2; k++) {
      const v = out[i + k];
      if (v !== undefined && v > 0) win.push(v);
    }
    win.sort((a, b) => a - b);
    sm[i] = win[Math.floor(win.length / 2)] as number;
  }
  // remove short runs
  let i = 0;
  while (i < sm.length) {
    if ((sm[i] as number) === 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < sm.length && (sm[j] as number) > 0) j++;
    if (j - i < 3) for (let k = i; k < j; k++) sm[k] = 0;
    i = j;
  }
  return sm;
}
