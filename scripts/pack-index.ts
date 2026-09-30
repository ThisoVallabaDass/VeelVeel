import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  extractFeatures,
  normalizeLoudness,
  resampleMono,
  trimSilence,
} from '../packages/dsp/src/index.js';

type CatalogClip = {
  clip_id: string;
  wav_path: string;
  video_title?: string;
  source_url?: string;
  start_s?: number;
  end_s?: number;
  flags?: string[];
  language?: 'ta' | 'en';
};
const root = process.cwd();
const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1]! : fallback;
};
const sourceRoot = path.resolve(root, option('--source', 'data/clips/wav'));
const manifestPath = path.resolve(root, option('--manifest', 'data/catalog/clips.jsonl'));
const extraManifestPath = path.resolve(root, option('--extra-manifest', 'data/catalog/extra-clips.jsonl'));
const packId = option('--id', 'tamil-meme');
const outputRoot = path.resolve(root, 'packs', packId);

function readWav(buffer: Buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE')
    throw new Error('Not a RIFF/WAVE file');
  let format = 0;
  let channels = 0;
  let sampleRate = 0;
  let bits = 0;
  let data: Buffer | undefined;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      format = buffer.readUInt16LE(body);
      channels = buffer.readUInt16LE(body + 2);
      sampleRate = buffer.readUInt32LE(body + 4);
      bits = buffer.readUInt16LE(body + 14);
    }
    if (id === 'data') {
      data = buffer.subarray(body, Math.min(buffer.length, body + size));
      break;
    }
    offset = body + size + (size & 1);
  }
  if (!data || !channels || !sampleRate || ![1, 3].includes(format) || ![16, 24, 32].includes(bits))
    throw new Error('Unsupported WAV encoding');
  const width = bits / 8;
  const frames = Math.floor(data.length / (width * channels));
  const mono = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      const offset = (frame * channels + channel) * width;
      let value: number;
      if (format === 3 && bits === 32) value = data.readFloatLE(offset);
      else if (bits === 16) value = data.readInt16LE(offset) / 32768;
      else if (bits === 24) {
        let raw = data[offset]! | (data[offset + 1]! << 8) | (data[offset + 2]! << 16);
        if (raw & 0x800000) raw |= ~0xffffff;
        value = raw / 8388608;
      } else value = data.readInt32LE(offset) / 2147483648;
      sum += value;
    }
    mono[frame] = sum / channels;
  }
  return { mono, sampleRate };
}
function writeWav(samples: Float32Array, sampleRate: number) {
  const payload = Buffer.alloc(samples.length * 2);
  const out = Buffer.alloc(44 + payload.length);
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + payload.length, 4);
  out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(sampleRate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(payload.length, 40);
  for (let i = 0; i < samples.length; i += 1)
    payload.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, samples[i]!)) * (samples[i]! < 0 ? 32768 : 32767)),
      i * 2,
    );
  payload.copy(out, 44);
  return out;
}
function difficulty(features: ReturnType<typeof extractFeatures>) {
  const voiced = features.frames.filter((frame) => frame.voicing > 0.4 && frame.pitchHz > 0);
  const pitchSpan = voiced.length
    ? Math.max(...voiced.map((f) => Math.log2(f.pitchHz))) -
      Math.min(...voiced.map((f) => Math.log2(f.pitchHz)))
    : 0;
  const onsets =
    features.frames.filter((frame) => frame.onset > 0.16).length /
    Math.max(1, features.frames.length);
  return features.durationSeconds * 0.7 + pitchSpan * 1.3 + onsets * 4;
}

await mkdir(path.join(outputRoot, 'clips'), { recursive: true });
await mkdir(path.join(outputRoot, 'features'), { recursive: true });
await mkdir(path.join(root, 'packs'), { recursive: true });
const catalogText = await readFile(manifestPath, 'utf8').catch((error: unknown) => {
  if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
  throw error;
});
const extraCatalogText = await readFile(extraManifestPath, 'utf8').catch((error: unknown) => {
  if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
  throw error;
});
const manifest = (catalogText + '\n' + extraCatalogText)
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line) as CatalogClip);
const clips: Array<Record<string, unknown>> = [];
let skipped = 0;
for (let index = 0; index < manifest.length; index += 1) {
  const item = manifest[index]!;
  const relative = item.wav_path.replace(/^data[\\/]clips[\\/]wav[\\/]/, '');
  const inputPath = path.resolve(sourceRoot, relative);
  try {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(item.clip_id)) throw new Error('Invalid clip ID');
    if (!inputPath.startsWith(sourceRoot + path.sep)) throw new Error('Clip path leaves source folder');
    if (item.language && !['ta', 'en'].includes(item.language)) throw new Error('Unsupported language');
    const input = readWav(await readFile(inputPath));
    const trimmed = trimSilence(resampleMono(input.mono, input.sampleRate, 22_050), 22_050).samples;
    const normalized = normalizeLoudness(trimmed, -18, -1).samples;
    const longClip = normalized.length > 8 * 22_050;
    const audio = normalized.subarray(0, 8 * 22_050);
    const features = extractFeatures(audio, 22_050);
    await writeFile(path.join(outputRoot, 'clips', `${item.clip_id}.wav`), writeWav(audio, 22_050));
    await writeFile(
      path.join(outputRoot, 'features', `${item.clip_id}.json`),
      JSON.stringify(features),
    );
    clips.push({
      id: item.clip_id,
      audio: `clips/${item.clip_id}.wav`,
      features: `features/${item.clip_id}.json`,
      title: '',
      label: '',
      language: item.language ?? 'ta',
      source: item.source_url ?? '',
      originalTitle: item.video_title ?? '',
      difficulty: difficulty(features),
      durationSeconds: features.durationSeconds,
      flags: [...(item.flags ?? []), ...(longClip ? ['too-long'] : [])],
      defaultRotation: !longClip,
      splitAtSeconds: [item.start_s ?? 0, item.end_s ?? features.durationSeconds],
    });
  } catch (error) {
    skipped += 1;
    console.error(
      `skip ${item.clip_id}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if ((index + 1) % 25 === 0 || index + 1 === manifest.length)
    console.log(`Indexed ${index + 1}/${manifest.length}`);
}
const usingDemo = clips.length === 0;
if (usingDemo) {
  console.log('No source clips found; generating a small synthesized demo pack.');
  for (let index = 0; index < 12; index += 1) {
    const id = `demo-${String(index + 1).padStart(2, '0')}`;
    const durationSeconds = 1.5 + (index % 4) * 0.35;
    const sampleRate = 22_050;
    const audio = new Float32Array(Math.round(durationSeconds * sampleRate));
    for (let sample = 0; sample < audio.length; sample += 1) {
      const time = sample / sampleRate;
      const pulse = time % 0.3;
      const envelope = Math.sin((Math.PI * Math.min(pulse, 0.22)) / 0.22) ** 2;
      const step = Math.floor(time / 0.3);
      const note = [1, 1.25, 1.5, 1.1, 0.9][(step + index) % 5]!;
      const frequency = (175 + index * 16) * note;
      audio[sample] =
        0.35 *
        envelope *
        (Math.sin(2 * Math.PI * frequency * time) +
          0.24 * Math.sin(2 * Math.PI * frequency * 2 * time));
    }
    const normalized = normalizeLoudness(audio, -18, -1).samples;
    const features = extractFeatures(normalized, sampleRate);
    await writeFile(path.join(outputRoot, 'clips', `${id}.wav`), writeWav(normalized, sampleRate));
    await writeFile(path.join(outputRoot, 'features', `${id}.json`), JSON.stringify(features));
    clips.push({
      id,
      audio: `clips/${id}.wav`,
      features: `features/${id}.json`,
      title: '',
      label: '',
      language: 'ta',
      source: '',
      originalTitle: '',
      difficulty: difficulty(features),
      durationSeconds: features.durationSeconds,
      flags: ['synthetic-demo'],
      defaultRotation: true,
      splitAtSeconds: [0, features.durationSeconds],
    });
  }
}
// Rank within this pack so a five-level picker remains useful even when most
// clips have the same raw complexity range.
const ranked = clips
  .map((clip, index) => ({ index, raw: Number(clip.difficulty) }))
  .sort((left, right) => left.raw - right.raw);
ranked.forEach(({ index }, position) => {
  clips[index]!.difficulty = Math.min(5, 1 + Math.floor((position * 5) / ranked.length));
});
const pack = {
  schemaVersion: 1,
  id: packId,
  title: usingDemo ? 'Synthetic Demo Sounds' : clips.some((clip) => clip.language === 'en') ? 'Tamil + English Meme Mix' : 'Tamil Meme Clips',
  language: clips.some((clip) => clip.language === 'en') ? 'mixed' : 'ta',
  region: clips.some((clip) => clip.language === 'en') ? 'Tamil + English' : 'Tamil Nadu',
  theme: 'festival',
  sampleRate: 22_050,
  createdAt: new Date().toISOString(),
  attribution: usingDemo
    ? 'Generated from sine waves in scripts/pack-index.ts; no external media.'
    : 'Clip source URLs are retained with each item; user-provided dataset.',
  labelsStatus: 'unlabeled',
  clipCount: clips.length,
  rotationCount: clips.filter((clip) => clip.defaultRotation).length,
  clips,
};
await writeFile(path.join(outputRoot, 'pack.json'), JSON.stringify(pack, null, 2));
await copyFile(
  path.join(root, 'apps/veel-veel/public/audio-capture-worklet.js'),
  path.join(root, 'packs/audio-capture-worklet.js'),
);
console.log(
  `Pack ${packId}: ${clips.length} clips, ${skipped} skipped → ${path.relative(root, outputRoot)}`,
);
