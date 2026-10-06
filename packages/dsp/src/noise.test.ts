import { expect, it } from 'vitest';
import { filterVoiceNoise } from './noise.js';

const rate = 22050;
const rms = (audio: Float32Array) => Math.sqrt(audio.reduce((sum, value) => sum + value * value, 0) / audio.length);
const tone = (hz: number, amplitude: number) => Float32Array.from({ length: rate }, (_, i) => amplitude * Math.sin(2 * Math.PI * hz * i / rate));

it('attenuates calibrated background hum while preserving a louder voice', () => {
  const hum = tone(80, 0.012);
  const voice = tone(440, 0.25);
  expect(rms(filterVoiceNoise(hum, rate, 0.012))).toBeLessThan(rms(hum) * 0.25);
  expect(rms(filterVoiceNoise(voice, rate, 0.012))).toBeGreaterThan(rms(voice) * 0.8);
});

it('removes DC and preserves buffer length without changing the original take', () => {
  const input = new Float32Array(rate).fill(0.1);
  const filtered = filterVoiceNoise(input, rate);
  expect(filtered.length).toBe(input.length);
  expect(rms(filtered.slice(rate / 2))).toBeLessThan(0.0001);
  expect(input.every((value) => value === Math.fround(0.1))).toBe(true);
  expect(filterVoiceNoise(new Float32Array(0), rate)).toHaveLength(0);
});
