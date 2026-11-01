/** Minimal RIFF/WAV reader (PCM 16-bit, any channel count -> mono mix). */
export function parseWav(buf: ArrayBuffer): { samples: Float32Array; sampleRate: number } {
  const v = new DataView(buf);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("Not a WAV file");
  let off = 12;
  let sampleRate = 0, channels = 1, bits = 16;
  while (off + 8 <= v.byteLength) {
    const id = tag(off);
    let size = v.getUint32(off + 4, true);
    if (id === "fmt ") {
      channels = v.getUint16(off + 10, true);
      sampleRate = v.getUint32(off + 12, true);
      bits = v.getUint16(off + 22, true);
    } else if (id === "data") {
      if (bits !== 16) throw new Error("Only 16-bit PCM supported");
      size = Math.min(size, v.byteLength - off - 8); // streamed WAVs may report 0xFFFFFFFF
      const frames = Math.floor(size / (2 * channels));
      const samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        let s = 0;
        for (let c = 0; c < channels; c++) s += v.getInt16(off + 8 + (i * channels + c) * 2, true);
        samples[i] = s / channels / 32768;
      }
      return { samples, sampleRate };
    }
    off += 8 + size + (size % 2);
  }
  throw new Error("No data chunk");
}

export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); w(8, "WAVE");
  w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 32767, true));
  return buf;
}
