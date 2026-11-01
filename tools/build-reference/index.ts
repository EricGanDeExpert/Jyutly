/**
 * Build reference audio + pitch contours from Azure Cantonese TTS.
 *
 *   cp .env.example .env   # add AZURE_SPEECH_KEY / AZURE_SPEECH_REGION
 *   node --env-file=.env --import tsx tools/build-reference/index.ts [voice] [--only id,id]
 *
 * Outputs (per voice, default zh-HK-HiuMaanNeural):
 *   content/audio/<voice>/<id>.wav
 *   content/references/<voice>/<id>.json   (Reference, normalized to the voice's own range)
 *   content/references/<voice>/_range.json (voice SpeakerRange)
 *   content/references/<voice>/_report.json (words whose auto syllable split needs a human check)
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildReference, detectPitch, frameRms, parseWav, segmentSyllables, speakerRange,
  type SyllableLabel,
} from "../../packages/tone-engine/src/index";

interface Word { id: string; hanzi: string; jyutping: string; english: string }

const root = resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
const voice = args.find((a) => !a.startsWith("--")) ?? "zh-HK-HiuMaanNeural";
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const key = process.env.AZURE_SPEECH_KEY;
const region = process.env.AZURE_SPEECH_REGION ?? "eastasia";
if (!key) throw new Error("Set AZURE_SPEECH_KEY (see .env.example)");

const words: Word[] = JSON.parse(readFileSync(resolve(root, "content/words.json"), "utf8"))
  .filter((w: Word) => !only || only.includes(w.id));
const audioDir = resolve(root, "content/audio", voice);
const refDir = resolve(root, "content/references", voice);
mkdirSync(audioDir, { recursive: true });
mkdirSync(refDir, { recursive: true });

async function tts(text: string): Promise<ArrayBuffer> {
  const ssml = `<speak version="1.0" xml:lang="zh-HK"><voice name="${voice}"><prosody rate="-10%">${text}</prosody></voice></speak>`;
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key!,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "riff-16khz-16bit-mono-pcm",
      "User-Agent": "jyutly-build-reference",
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`Azure TTS ${res.status}: ${await res.text()}`);
  return res.arrayBuffer();
}

// Pass 1: synthesize + track pitch
const tracks = new Map<string, { track: ReturnType<typeof detectPitch>; rms: number[] }>();
for (const w of words) {
  const wavPath = resolve(audioDir, `${w.id}.wav`);
  const buf = existsSync(wavPath) ? readFileSync(wavPath).buffer.slice(0) as ArrayBuffer : await tts(w.hanzi);
  if (!existsSync(wavPath)) writeFileSync(wavPath, Buffer.from(buf));
  const { samples, sampleRate } = parseWav(buf);
  tracks.set(w.id, { track: detectPitch(samples, sampleRate), rms: frameRms(samples, sampleRate) });
  console.log("tracked", w.id);
}

// Pass 2: voice range from ALL words, then references
const range = speakerRange(...[...tracks.values()].map((t) => t.track.f0));
writeFileSync(resolve(refDir, "_range.json"), JSON.stringify(range, null, 2));
const report: Array<{ id: string; reason: string }> = [];

for (const w of words) {
  const { track, rms } = tracks.get(w.id)!;
  const syl = w.jyutping.split(" ");
  const { segments, ok } = segmentSyllables(rms, track.f0, syl.length);
  if (segments.length !== syl.length) { report.push({ id: w.id, reason: "no voiced audio" }); continue; }
  if (!ok) report.push({ id: w.id, reason: "syllable split fell back to equal parts; check by ear" });
  const labels: SyllableLabel[] = syl.map((j, i) => ({
    jyutping: j,
    tone: Number(j.slice(-1)),
    startMs: segments[i]![0] * track.hopSec * 1000,
    endMs: segments[i]![1] * track.hopSec * 1000,
  }));
  writeFileSync(resolve(refDir, `${w.id}.json`), JSON.stringify(buildReference(w.id, track, range, labels)));
}
writeFileSync(resolve(refDir, "_report.json"), JSON.stringify(report, null, 2));
console.log(`done: ${words.length} words, ${report.length} need review`);
