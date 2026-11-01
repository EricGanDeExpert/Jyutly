import { describe, expect, it } from "vitest";
import { detectPitch } from "../src/pitch";
import { sine } from "./helpers";

describe("detectPitch", () => {
  it("tracks a glide within ~3%", () => {
    const sr = 16000;
    const target = Array.from({ length: 80 }, (_, i) => 120 + (i * 100) / 79); // 120->220 Hz
    const audio = sine(target, 0.01, sr);
    const { f0 } = detectPitch(audio, sr);
    const mid = f0.slice(10, 60);
    expect(mid.every((f) => f > 0)).toBe(true);
    mid.forEach((f, k) => {
      const exp = target[10 + k]!;
      expect(Math.abs(f - exp) / exp).toBeLessThan(0.03);
    });
  });
  it("marks silence unvoiced", () => {
    const { f0 } = detectPitch(new Float32Array(16000), 16000);
    expect(f0.every((f) => f === 0)).toBe(true);
  });
});
