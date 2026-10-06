import { describe, expect, it } from 'vitest';
import { extractFeatures, scoreFeatures } from './index.js';

const rate = 22_050;
function phrase(scale = 1, duration = 2.2) {
  const audio = new Float32Array(Math.round(rate * duration));
  const notes = [196, 220, 246.94, 220, 174.61, 196, 261.63, 220];
  const syllable = 0.24 * scale;
  for (let i = 0; i < audio.length; i += 1) {
    const t = i / rate;
    const unit = Math.floor(t / syllable);
    const within = (t % syllable) / syllable;
    const envelope =
      within < 0.78 ? Math.min(1, within * 12) * Math.min(1, (0.78 - within) * 9) : 0;
    const f = notes[unit % notes.length]!;
    audio[i] =
      0.42 *
      envelope *
      (Math.sin(2 * Math.PI * f * t) + 0.22 * Math.sin(2 * Math.PI * f * 2.01 * t));
  }
  return audio;
}
const analyze = (audio: Float32Array) => extractFeatures(audio, rate);

describe('audio features and party scoring', () => {
  it('tracks a voiced melodic phrase and discounts a one-note imitation', () => {
    const original = phrase();
    const oneNote = new Float32Array(original.length);
    for (let i = 0; i < oneNote.length; i += 1) {
      const t = i / rate;
      const within = (t % 0.24) / 0.24;
      const envelope = within < 0.78 ? Math.min(1, within * 12) * Math.min(1, (0.78 - within) * 9) : 0;
      oneNote[i] = 0.42 * envelope * (Math.sin(2 * Math.PI * 220 * t) + 0.22 * Math.sin(2 * Math.PI * 440 * t));
    }
    const reference = analyze(original);
    const flat = analyze(oneNote);
    expect(reference.frames.filter((frame) => frame.voicing > 0.45).length / reference.frames.length).toBeGreaterThan(0.3);
    expect(scoreFeatures(reference, flat).total).toBeLessThan(85);
  });
  it('scores an identical take at 95 or higher', () => {
    const reference = analyze(phrase());
    expect(scoreFeatures(reference, reference).total).toBeGreaterThanOrEqual(95);
  });

  it('recognizes a melody transposed by five semitones', () => {
    const original = phrase();
    // Rebuild each note at a uniform pitch shift while preserving its envelope.
    const transpose = 2 ** (5 / 12);
    const audio = new Float32Array(original.length);
    const syllableSamples = Math.round(rate * 0.24);
    const notes = [196, 220, 246.94, 220, 174.61, 196, 261.63, 220];
    for (let i = 0; i < audio.length; i += 1) {
      const t = i / rate;
      const unit = Math.floor(i / syllableSamples);
      const within = (i % syllableSamples) / syllableSamples;
      const env = within < 0.78 ? Math.min(1, within * 12) * Math.min(1, (0.78 - within) * 9) : 0;
      const f = notes[unit % notes.length]! * transpose;
      audio[i] =
        0.42 * env * (Math.sin(2 * Math.PI * f * t) + 0.22 * Math.sin(2 * Math.PI * f * 2.01 * t));
    }
    expect(scoreFeatures(analyze(original), analyze(audio)).total).toBeGreaterThanOrEqual(80);
  });

  it('tolerates a 15 percent time stretch', () => {
    const original = phrase();
    const stretched = new Float32Array(Math.round(original.length * 1.15));
    for (let i = 0; i < stretched.length; i += 1)
      stretched[i] = original[Math.min(original.length - 1, Math.floor(i / 1.15))]!;
    expect(scoreFeatures(analyze(original), analyze(stretched)).total).toBeGreaterThanOrEqual(75);
  });

  it('caps white-noise attempts at 25', () => {
    let state = 0x12345678;
    const noise = new Float32Array(rate * 2);
    for (let i = 0; i < noise.length; i += 1) {
      state = (1664525 * state + 1013904223) >>> 0;
      noise[i] = ((state / 0xffffffff) * 2 - 1) * 0.12;
    }
    expect(scoreFeatures(analyze(phrase()), analyze(noise)).total).toBeLessThanOrEqual(25);
  });

  it('scores silence at zero', () => {
    const silent = analyze(new Float32Array(rate));
    expect(scoreFeatures(analyze(phrase()), silent).total).toBe(0);
  });
  it('does not reward copying only a tiny fraction of the phrase', () => {
    const reference = phrase();
    expect(scoreFeatures(analyze(reference), analyze(reference.slice(0, rate * 0.2))).total).toBeLessThan(30);
  });
});
