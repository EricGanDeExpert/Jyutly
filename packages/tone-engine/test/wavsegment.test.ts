import { describe, expect, it } from "vitest";
import { encodeWav, parseWav } from "../src/wav";
import { segmentSyllables } from "../src/segment";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("wav", () => {
  it("round-trips", () => {
    const x = Float32Array.from({ length: 800 }, (_, i) => Math.sin(i / 10) * 0.5);
    const { samples, sampleRate } = parseWav(encodeWav(x, 16000));
    expect(sampleRate).toBe(16000);
    expect(samples.length).toBe(800);
    expect(Math.abs(samples[123]! - x[123]!)).toBeLessThan(1e-3);
  });
});

describe("segmentSyllables", () => {
  it("splits at energy dips", () => {
    // three bumps of 30 frames separated by dips at 30 and 60
    const rms = Array.from({ length: 90 }, (_, i) => 0.2 + 0.8 * Math.abs(Math.sin((i / 30) * Math.PI)));
    const f0 = new Array(90).fill(150);
    const { segments, ok } = segmentSyllables(rms, f0, 3);
    expect(ok).toBe(true);
    expect(Math.abs(segments[0]![1] - 30)).toBeLessThanOrEqual(2);
    expect(Math.abs(segments[1]![1] - 60)).toBeLessThanOrEqual(2);
  });
  it("falls back to equal split and reports not ok", () => {
    const { segments, ok } = segmentSyllables(new Array(60).fill(1), new Array(60).fill(150), 3);
    expect(ok).toBe(false);
    expect(segments).toHaveLength(3);
  });
});

describe("content/words.json", () => {
  const words = JSON.parse(readFileSync(resolve(__dirname, "../../../content/words.json"), "utf8"));
  it("has unique ids, matching syllable counts, valid tones", () => {
    const ids = new Set<string>();
    for (const w of words) {
      expect(ids.has(w.id)).toBe(false);
      ids.add(w.id);
      const syl = w.jyutping.split(" ");
      expect(syl.length, w.id).toBe([...w.hanzi].length);
      for (const s of syl) expect(s, w.id).toMatch(/^[a-z]+[1-6]$/);
    }
  });
  it("covers all six tones and has ~50+ entries", () => {
    const tones = new Set(words.flatMap((w: any) => w.jyutping.split(" ").map((s: string) => s.slice(-1))));
    expect([...tones].sort()).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(words.length).toBeGreaterThanOrEqual(50);
  });
});
