import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { extractFeatures, normalizeLoudness } from '../packages/dsp/src/index.js';

interface OpenSource {
  id: string; filename: string; title: string; category: string; language: 'ta' | 'en';
  cutStart: number; duration: number; rights: string; credit: string; sourcePage: string;
}
interface PackClip extends Record<string, unknown> {
  id: string; audio: string; features: string; category?: string; rights?: string;
}
async function decodeAndEncodeWav({ base64, start, duration }: { base64: string; start: number; duration: number }) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  const context = new AudioContext();
  const decoded = await context.decodeAudioData(bytes.buffer);
  const sampleRate = 22_050;
  const length = Math.max(1, Math.floor(Math.min(duration, 8) * sampleRate));
  const samples = new Int16Array(length);
  for (let index = 0; index < length; index++) {
    const sourcePosition = (start + index / sampleRate) * decoded.sampleRate;
    if (sourcePosition >= decoded.length) break;
    const leftIndex = Math.floor(sourcePosition);
    const fraction = sourcePosition - leftIndex;
    let sample = 0;
    for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
      const data = decoded.getChannelData(channel);
      const left = data[leftIndex] ?? 0;
      const right = data[Math.min(decoded.length - 1, leftIndex + 1)] ?? left;
      sample += left + (right - left) * fraction;
    }
    sample /= decoded.numberOfChannels;
    samples[index] = Math.round(Math.max(-1, Math.min(1, sample)) * (sample < 0 ? 32768 : 32767));
  }
  await context.close();
  const wav = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(wav.buffer);
  function ascii(offset: number, text: string) { for (let index = 0; index < text.length; index++) wav[offset + index] = text.charCodeAt(index); }
  ascii(0, 'RIFF'); view.setUint32(4, wav.length - 8, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index++) view.setInt16(44 + index * 2, samples[index]!, true);
  let encoded = '';
  for (const byte of wav) encoded += String.fromCharCode(byte);
  return btoa(encoded);
}
const root = process.cwd();
const packRoot = path.resolve(root, 'packs/tamil-meme');
const sources = JSON.parse(await readFile(path.resolve(root, 'scripts/open-sound-sources.json'), 'utf8')) as OpenSource[];
const packPath = path.join(packRoot, 'pack.json');
const pack = JSON.parse(await readFile(packPath, 'utf8')) as { clips: PackClip[]; clipCount: number; rotationCount: number };
function metadata(source: OpenSource, durationSeconds: number): PackClip {
  return {
    id: source.id, title: source.title, label: source.title, category: source.category,
    language: source.language, rights: source.rights, credit: source.credit, source: source.sourcePage,
    audio: `clips/${source.id}.wav`, features: `features/${source.id}.json`,
    difficulty: 2, durationSeconds, flags: ['human-vocal', 'open-license'], defaultRotation: true,
  };
}
async function savePack() {
  pack.clipCount = pack.clips.length;
  await writeFile(packPath, JSON.stringify(pack, null, 2), 'utf8');
}
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.evaluate('window.__name = (fn) => fn');
  for (const source of sources) {
    if (pack.clips.some((clip) => clip.id === source.id)) {
      console.log(`Already present: ${source.id}`);
      continue;
    }
    const wavPath = path.join(packRoot, 'clips', `${source.id}.wav`);
    const featuresPath = path.join(packRoot, 'features', `${source.id}.json`);
    try {
      await Promise.all([access(wavPath), access(featuresPath)]);
      const features = JSON.parse(await readFile(featuresPath, 'utf8')) as { durationSeconds: number };
      pack.clips.push(metadata(source, features.durationSeconds));
      pack.rotationCount += 1;
      await savePack();
      console.log(`Recovered generated clip: ${source.id}`);
      continue;
    } catch { /* Generate missing assets below. */ }
    const fileUrl = `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(source.filename)}`;
    let response: Response | undefined;
    for (let attempt = 0; attempt < 4; attempt++) {
      response = await fetch(fileUrl, { headers: { 'User-Agent': 'VeelVeel party game sound pack importer/1.0' } });
      if (response.status !== 429) break;
      const retryAfter = Number(response.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : (attempt + 1) * 15_000;
      console.log(`Commons asked to slow down; retrying ${source.id} in ${Math.ceil(delay / 1000)} seconds.`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (!response) throw new Error(`Download failed for ${source.filename}`);
    if (!response.ok) throw new Error(`Download failed for ${source.filename}: HTTP ${response.status}`);
    const original = Buffer.from(await response.arrayBuffer());
    const wav64 = await page.evaluate(decodeAndEncodeWav, { base64: original.toString('base64'), start: source.cutStart, duration: source.duration });
    const wav = Buffer.from(wav64, 'base64');
    const rawSamples = new Float32Array((wav.length - 44) / 2);
    for (let index = 0; index < rawSamples.length; index++) rawSamples[index] = wav.readInt16LE(44 + index * 2) / 32768;
    const normalized = normalizeLoudness(rawSamples, -18, -1).samples;
    const pcm = Buffer.alloc(normalized.length * 2);
    for (let index = 0; index < normalized.length; index++) {
      const sample = Math.max(-1, Math.min(1, normalized[index]!));
      pcm.writeInt16LE(Math.round(sample * (sample < 0 ? 32768 : 32767)), index * 2);
    }
    const outputWav = Buffer.from(wav.subarray(0, 44));
    outputWav.writeUInt32LE(36 + pcm.length, 4);
    outputWav.writeUInt32LE(pcm.length, 40);
    await mkdir(path.join(packRoot, 'clips'), { recursive: true });
    await mkdir(path.join(packRoot, 'features'), { recursive: true });
    await writeFile(path.join(packRoot, 'clips', `${source.id}.wav`), Buffer.concat([outputWav, pcm]));
    await writeFile(path.join(packRoot, 'features', `${source.id}.json`), JSON.stringify(extractFeatures(normalized, 22_050)));
    pack.clips.push(metadata(source, normalized.length / 22_050));
    pack.rotationCount += 1;
    await savePack();
    console.log(`Added ${source.id} · ${source.rights}`);
  }
  await savePack();
  console.log(`Updated ${pack.clipCount}-clip library at ${packRoot}`);
} finally { await browser.close(); }
