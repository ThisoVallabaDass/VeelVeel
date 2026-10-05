import { describe, expect, it } from 'vitest';
import { extractFeatures, hasAudibleTake } from '@veel-veel/dsp';
import { scoreTake } from './mic.js';
const rate = 22050;
const referenceAudio = Float32Array.from(
  { length: rate * 2 },
  (_, i) =>
    0.2 * Math.sin((i * 2 * Math.PI * 220) / rate) * (0.5 + 0.5 * Math.sin((i / rate) * 12)),
);
const reference = extractFeatures(referenceAudio, rate);
describe('actual microphone scoring path', () => {
  it('returns zero for digital silence and an empty capture', () => {
    for (const samples of [new Float32Array(rate * 2), new Float32Array()])
      expect(scoreTake(samples, rate, reference).total).toBe(0);
  });
  it('returns zero for quiet microphone hiss, DC offset and a solitary click', () => {
    let seed = 12;
    const hiss = Float32Array.from({ length: rate * 2 }, () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return ((seed / 0xffffffff) * 2 - 1) * 0.008;
    });
    const click = new Float32Array(rate * 2);
    click.fill(0.3, rate, rate + 120);
    for (const samples of [hiss, new Float32Array(rate * 2).fill(0.015), click])
      expect(scoreTake(samples, rate, reference).total).toBe(0);
  });
  it('rejects a calibrated fan/hum but accepts a voice above it', () => {
    const hum = Float32Array.from(
      { length: rate * 2 },
      (_, i) => 0.03 * Math.sin((i * 2 * Math.PI * 80) / rate),
    );
    expect(hasAudibleTake(hum, rate, 0.022)).toBe(false);
    expect(hasAudibleTake(referenceAudio, rate, 0.022)).toBe(true);
  });
  it('still recognizes the same audible recording', () => {
    expect(scoreTake(referenceAudio, rate, reference).total).toBeGreaterThanOrEqual(90);
  });
});
