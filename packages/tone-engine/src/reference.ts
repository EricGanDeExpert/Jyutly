import { fillAndTrim, normalizeContour, SpeakerRange } from "./normalize";
import type { PitchTrack } from "./pitch";

export interface SyllableLabel {
  jyutping: string;
  /** Cantonese tone 1-6. */
  tone: number;
  startMs: number;
  endMs: number;
}

export interface ReferenceSyllable {
  jyutping: string;
  tone: number;
  /** Frame range [start, end) in the reference contour. */
  start: number;
  end: number;
}

/** Stored as JSON next to the native audio; contour is normalized to the reference speaker's range. */
export interface Reference {
  id: string;
  hopSec: number;
  contour: number[];
  syllables: ReferenceSyllable[];
}

export function buildReference(
  id: string,
  track: PitchTrack,
  range: SpeakerRange,
  labels: SyllableLabel[],
): Reference {
  const { contour, offset } = fillAndTrim(normalizeContour(track.f0, range));
  const toFrame = (ms: number) =>
    Math.min(contour.length, Math.max(0, Math.round(ms / 1000 / track.hopSec) - offset));
  const syllables = labels.map((l) => ({
    jyutping: l.jyutping,
    tone: l.tone,
    start: toFrame(l.startMs),
    end: Math.max(toFrame(l.endMs), toFrame(l.startMs) + 1),
  }));
  return { id, hopSec: track.hopSec, contour, syllables };
}
