import { fft, hann } from './window.js';
import type { AudioFeatures, DspConfig, FeatureFrame } from './types.js';

export const DEFAULT_DSP_CONFIG: DspConfig = {
  targetSampleRate: 22_050,
  frameMs: 20,
  hopMs: 10,
  mfccCount: 13,
  melBands: 26,
  minPitchHz: 65,
  maxPitchHz: 500,
};

const hzToMel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
const melToHz = (mel: number) => 700 * (10 ** (mel / 2595) - 1);

function autocorrelationPitch(
  frame: Float32Array,
  sampleRate: number,
  minHz: number,
  maxHz: number,
) {
  // Downsampling by two keeps YIN's difference function cheap while preserving
  // the requested vocal range. FFT autocorrelation is O(n log n).
  const signal = new Float64Array(256);
  for (let i = 0; i < 256; i += 1)
    signal[i] = (frame[i * 2] ?? 0) - (frame[Math.max(0, i * 2 - 1)] ?? 0);
  const real = new Float64Array(512);
  const imag = new Float64Array(512);
  for (let i = 0; i < signal.length; i += 1) real[i] = signal[i]!;
  fft(real, imag);
  for (let i = 0; i < real.length; i += 1) {
    real[i] = real[i]! * real[i]! + imag[i]! * imag[i]!;
    imag[i] = 0;
  }
  fft(real, imag, true);
  const rate = sampleRate / 2;
  const minLag = Math.max(2, Math.floor(rate / maxHz));
  const maxLag = Math.min(200, Math.ceil(rate / minHz));
  const differences = new Float64Array(maxLag + 1);
  let cumulative = 0;
  for (let tau = 1; tau <= maxLag; tau += 1) {
    differences[tau] = Math.max(0, real[0]! - real[tau]!);
    cumulative += differences[tau]!;
    differences[tau] = cumulative === 0 ? 1 : (differences[tau]! * tau) / cumulative;
  }
  let bestLag = 0;
  let best = 0.22;
  for (let tau = minLag; tau <= maxLag; tau += 1) {
    if (differences[tau]! < best) {
      best = differences[tau]!;
      bestLag = tau;
    }
  }
  if (!bestLag || best > 0.42) return { pitchHz: 0, voicing: 0 };
  const left = differences[bestLag - 1] ?? best;
  const right = differences[bestLag + 1] ?? best;
  const denom = left - 2 * best + right;
  const correction = Math.abs(denom) < 1e-8 ? 0 : (0.5 * (left - right)) / denom;
  return { pitchHz: rate / (bestLag + correction), voicing: Math.max(0, Math.min(1, 1 - best)) };
}

function makeMelFilters(sampleRate: number, fftSize: number, bands: number) {
  const low = hzToMel(0);
  const high = hzToMel(sampleRate / 2);
  const points = Array.from({ length: bands + 2 }, (_, i) =>
    melToHz(low + ((high - low) * i) / (bands + 1)),
  );
  return Array.from({ length: bands }, (_, band) => {
    const left = points[band]!;
    const center = points[band + 1]!;
    const right = points[band + 2]!;
    return Array.from({ length: fftSize / 2 + 1 }, (_, bin) => {
      const hz = (bin * sampleRate) / fftSize;
      return hz < left || hz > right
        ? 0
        : hz <= center
          ? (hz - left) / Math.max(1, center - left)
          : (right - hz) / Math.max(1, right - center);
    });
  });
}

function mfcc(magnitudes: Float64Array, filters: number[][], count: number) {
  const logs = filters.map((filter) => {
    let energy = 0;
    for (let i = 0; i < filter.length; i += 1)
      energy += magnitudes[i]! * magnitudes[i]! * filter[i]!;
    return Math.log(Math.max(1e-10, energy));
  });
  return Array.from({ length: count }, (_, coefficient) => {
    let value = 0;
    for (let band = 0; band < logs.length; band += 1)
      value += logs[band]! * Math.cos((Math.PI * coefficient * (band + 0.5)) / logs.length);
    return value / logs.length;
  });
}

/** Extract 10 ms feature frames: energy, onset, YIN pitch, centroid and 13 MFCCs. */
export function extractFeatures(
  audio: Float32Array,
  sampleRate = 22_050,
  config = DEFAULT_DSP_CONFIG,
): AudioFeatures {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0)
    throw new Error('Sample rate must be positive');
  const frameSize = Math.max(128, Math.round((sampleRate * config.frameMs) / 1000));
  const hopSize = Math.max(1, Math.round((sampleRate * config.hopMs) / 1000));
  const fftSize = 512;
  const taper = hann(frameSize);
  const filters = makeMelFilters(sampleRate, fftSize, config.melBands);
  const frames: FeatureFrame[] = [];
  let previousMagnitude = new Float64Array(fftSize / 2 + 1);
  const count = Math.max(1, Math.ceil(Math.max(0, audio.length - frameSize) / hopSize) + 1);
  for (let frameIndex = 0; frameIndex < count; frameIndex += 1) {
    const start = frameIndex * hopSize;
    const frame = new Float32Array(frameSize);
    let square = 0;
    for (let i = 0; i < frameSize; i += 1) {
      const value = (audio[start + i] ?? 0) * taper[i]!;
      frame[i] = value;
      square += value * value;
    }
    const rms = Math.sqrt(square / frameSize);
    const real = new Float64Array(fftSize);
    const imag = new Float64Array(fftSize);
    for (let i = 0; i < Math.min(frameSize, fftSize); i += 1) real[i] = frame[i]!;
    fft(real, imag);
    const magnitudes = new Float64Array(fftSize / 2 + 1);
    let magnitudeSum = 0;
    let weighted = 0;
    let flux = 0;
    for (let bin = 0; bin < magnitudes.length; bin += 1) {
      const mag = Math.hypot(real[bin]!, imag[bin]!);
      magnitudes[bin] = mag;
      magnitudeSum += mag;
      weighted += mag * ((bin * sampleRate) / fftSize);
      flux += Math.max(0, mag - previousMagnitude[bin]!);
    }
    const pitch =
      rms > 0.003
        ? autocorrelationPitch(frame, sampleRate, config.minPitchHz, config.maxPitchHz)
        : { pitchHz: 0, voicing: 0 };
    frames.push({
      timeMs: (start * 1000) / sampleRate,
      logEnergy: Math.log10(Math.max(1e-7, rms)),
      onset: flux / Math.max(1e-8, magnitudeSum),
      pitchHz: pitch.pitchHz,
      voicing: pitch.voicing,
      centroidHz: magnitudeSum < 1e-8 ? 0 : weighted / magnitudeSum,
      mfcc: mfcc(magnitudes, filters, config.mfccCount),
    });
    previousMagnitude = magnitudes;
  }
  return { sampleRate, hopMs: config.hopMs, durationSeconds: audio.length / sampleRate, frames };
}
