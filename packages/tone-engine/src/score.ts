import { dtw, mapSegment } from "./align";
import { feedbackFor } from "./feedback";
import { fillAndTrim, normalizeContour, resample, SpeakerRange } from "./normalize";
import type { PitchTrack } from "./pitch";
import type { Reference } from "./reference";

export interface SyllableScore {
  index: number;
  jyutping: string;
  tone: number;
  /** 0-100 */
  score: number;
  message: string;
  /** resampled (20 pts) normalized contours, for plotting. */
  user: number[];
  reference: number[];
}

export interface AttemptScore {
  /** 0-100, mean of syllable scores. */
  overall: number;
  syllables: SyllableScore[];
  /** whole-attempt aligned contours for the pitch chart. */
  userContour: number[];
}

const N = 20;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1);

function linearChange(a: number[]): number {
  const n = a.length;
  const tm = (n - 1) / 2;
  const ym = mean(a);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - tm) * ((a[i] as number) - ym);
    den += (i - tm) ** 2;
  }
  return den === 0 ? 0 : (num / den) * (n - 1);
}

export function scoreAttempt(
  track: PitchTrack,
  ref: Reference,
  range: SpeakerRange,
): AttemptScore {
  const { contour: user } = fillAndTrim(normalizeContour(track.f0, range));
  if (user.length < 3 || ref.contour.length < 3) {
    return { overall: 0, syllables: [], userContour: user };
  }
  // align on shape only so a height error doesn't corrupt syllable boundaries
  const um = mean(user);
  const rm = mean(ref.contour);
  const path = dtw(
    user.map((v) => v - um),
    ref.contour.map((v) => v - rm),
  );

  const syllables: SyllableScore[] = ref.syllables.map((syl, index) => {
    const seg = mapSegment(path, syl.start, syl.end);
    const refSeg = resample(ref.contour.slice(syl.start, Math.max(syl.end, syl.start + 1)), N);
    if (!seg) {
      return {
        index, jyutping: syl.jyutping, tone: syl.tone, score: 0,
        message: "We couldn't hear this syllable.", user: [], reference: refSeg,
      };
    }
    const userSeg = resample(user.slice(seg[0], seg[1] + 1), N);
    const uMean = mean(userSeg);
    const rMean = mean(refSeg);
    let sq = 0;
    for (let i = 0; i < N; i++) {
      sq += ((userSeg[i] as number) - uMean - ((refSeg[i] as number) - rMean)) ** 2;
    }
    const shapeErr = Math.sqrt(sq / N);
    const heightDelta = uMean - rMean;
    const changeDelta = linearChange(userSeg) - linearChange(refSeg);

    const shape = clamp01(1 - shapeErr / 0.3);
    const height = clamp01(1 - Math.abs(heightDelta) / 0.3);
    const score = Math.round(100 * (0.6 * shape + 0.4 * height));
    return {
      index, jyutping: syl.jyutping, tone: syl.tone, score,
      message: feedbackFor(score, { heightDelta, changeDelta, refChange: linearChange(refSeg) }),
      user: userSeg, reference: refSeg,
    };
  });

  return {
    overall: Math.round(mean(syllables.map((s) => s.score))),
    syllables,
    userContour: user,
  };
}
