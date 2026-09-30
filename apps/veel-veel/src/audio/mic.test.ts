import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractFeatures, scoreFeatures } from '@veel-veel/dsp';

interface PackClip {
  id: string;
  audio: string;
  features: string;
  defaultRotation: boolean;
}

function readPcm16MonoWav(filePath: string) {
  const wav = readFileSync(filePath);
  const sampleRate = wav.readUInt32LE(24);
  let offset = 12;
  let dataOffset = 0;
  let dataSize = 0;
  let channels = 1;
  let bits = 16;
  while (offset + 8 < wav.length) {
    const chunkSize = wav.readUInt32LE(offset + 4);
    if (wav.toString('ascii', offset, offset + 4) === 'fmt ') {
      channels = wav.readUInt16LE(offset + 10);
      bits = wav.readUInt16LE(offset + 22);
    }
    if (wav.toString('ascii', offset, offset + 4) === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize + (chunkSize & 1);
  }
  if (channels !== 1 || bits !== 16 || !dataSize)
    throw new Error('Expected normalized mono PCM16 pack audio');
  const audio = new Float32Array(dataSize / 2);
  for (let i = 0; i < audio.length; i += 1) audio[i] = wav.readInt16LE(dataOffset + i * 2) / 32768;
  return { audio, sampleRate };
}

describe('real Tamil pack integration', () => {
  it('scores a real normalized source clip against its precomputed DSP features at 95+', () => {
    const root = path.resolve(process.cwd(), 'packs/tamil-meme');
    const pack = JSON.parse(readFileSync(path.join(root, 'pack.json'), 'utf8')) as {
      clips: PackClip[];
    };
    const clip = pack.clips.find((item) => item.defaultRotation);
    expect(clip).toBeDefined();
    const { audio, sampleRate } = readPcm16MonoWav(path.join(root, clip!.audio));
    const reference = JSON.parse(
      readFileSync(path.join(root, clip!.features), 'utf8'),
    ) as ReturnType<typeof extractFeatures>;
    expect(
      scoreFeatures(reference, extractFeatures(audio, sampleRate)).total,
    ).toBeGreaterThanOrEqual(95);
  });
});
