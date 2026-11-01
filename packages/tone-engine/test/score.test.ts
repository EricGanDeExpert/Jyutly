import { describe, expect, it } from "vitest";
import { buildReference } from "../src/reference";
import { scoreAttempt } from "../src/score";
import type { SpeakerRange } from "../src/normalize";
import { synth } from "./helpers";

const male: SpeakerRange = { centerSt: -4, spanSt: 9 };    // ~80 Hz centre
const female: SpeakerRange = { centerSt: 8, spanSt: 12 };  // ~160 Hz centre
const tones = [1, 4]; // e.g. a 2-syllable word

function makeRef() {
  const { track, boundsMs } = synth(tones, male);
  return buildReference("w", track, male, boundsMs.map(([s, e], i) => ({
    jyutping: `s${i}`, tone: tones[i]!, startMs: s, endMs: e,
  })));
}

describe("scoreAttempt", () => {
  it("scores a correct attempt from a different speaker high", () => {
    const { track } = synth(tones, female);
    const r = scoreAttempt(track, makeRef(), female);
    expect(r.overall).toBeGreaterThanOrEqual(90);
  });
  it("tolerates different speaking rate", () => {
    const { track } = synth(tones, female, { framesPerSyl: 36 });
    expect(scoreAttempt(track, makeRef(), female).overall).toBeGreaterThanOrEqual(85);
  });
  it("flags a wrong contour on syllable 2", () => {
    // reference wants falling (4); learner rises
    const { track } = synth(tones, female, { override: { 1: [1, 4] } });
    const r = scoreAttempt(track, makeRef(), female);
    expect(r.syllables[0]!.score).toBeGreaterThanOrEqual(85);
    expect(r.syllables[1]!.score).toBeLessThan(70);
    expect(r.syllables[1]!.message).toMatch(/fall more/);
  });
  it("flags going too high", () => {
    const { track } = synth(tones, female, { override: { 0: [6.5, 6.5] } });
    const r = scoreAttempt(track, makeRef(), female);
    expect(r.syllables[0]!.message).toMatch(/too high/);
  });
});
