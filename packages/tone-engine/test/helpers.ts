import { stToHz, SpeakerRange } from "../src/normalize";
import type { PitchTrack } from "../src/pitch";

/** Cantonese tone shapes as 1-5 pitch levels (Chao numerals). */
export const TONES: Record<number, number[]> = {
  1: [5, 5], 2: [2, 5], 3: [3, 3], 4: [2, 1], 5: [2, 3], 6: [2, 2],
};

/** Build a synthetic f0 track for a sequence of tones for a given speaker. */
export function synth(
  tones: number[],
  speaker: SpeakerRange,
  opts: { framesPerSyl?: number; override?: Record<number, number[]> } = {},
): { track: PitchTrack; boundsMs: Array<[number, number]> } {
  const fps = opts.framesPerSyl ?? 24;
  const f0: number[] = [];
  const boundsMs: Array<[number, number]> = [];
  tones.forEach((t, si) => {
    const levels = opts.override?.[si] ?? TONES[t]!;
    const start = f0.length;
    for (let k = 0; k < fps; k++) {
      const x = (k / (fps - 1)) * (levels.length - 1);
      const lo = Math.floor(x);
      const hi = Math.min(levels.length - 1, lo + 1);
      const lvl = levels[lo]! + (levels[hi]! - levels[lo]!) * (x - lo);
      f0.push(stToHz(speaker.centerSt + ((lvl - 3) * speaker.spanSt) / 4));
    }
    boundsMs.push([start * 10, f0.length * 10]);
    if (si < tones.length - 1) for (let g = 0; g < 3; g++) f0.push(0);
  });
  return { track: { hopSec: 0.01, f0 }, boundsMs };
}

export function sine(f0Hz: number[], hopSec: number, sr: number): Float32Array {
  const hopN = Math.round(hopSec * sr);
  const out = new Float32Array(f0Hz.length * hopN);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const f = f0Hz[Math.min(f0Hz.length - 1, Math.floor(i / hopN))]!;
    phase += (2 * Math.PI * f) / sr;
    out[i] = 0.6 * Math.sin(phase) + 0.25 * Math.sin(2 * phase) + 0.1 * Math.sin(3 * phase);
  }
  return out;
}
