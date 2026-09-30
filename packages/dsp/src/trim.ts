export interface TrimResult {
  samples: Float32Array;
  leadingSeconds: number;
  trailingSeconds: number;
}

/** Trim quiet bookends but keep 90 ms so plosive attacks and room tails survive. */
export function trimSilence(
  samples: Float32Array,
  sampleRate: number,
  thresholdDb = -48,
  padMs = 90,
): TrimResult {
  const frame = Math.max(1, Math.round(sampleRate * 0.02));
  const threshold = 10 ** (thresholdDb / 20);
  let first = samples.length;
  let last = 0;
  for (let start = 0; start < samples.length; start += frame) {
    const end = Math.min(samples.length, start + frame);
    let energy = 0;
    for (let i = start; i < end; i += 1) energy += samples[i]! * samples[i]!;
    if (Math.sqrt(energy / Math.max(1, end - start)) >= threshold) {
      first = Math.min(first, start);
      last = end;
    }
  }
  if (first === samples.length)
    return {
      samples: new Float32Array(),
      leadingSeconds: samples.length / sampleRate,
      trailingSeconds: 0,
    };
  const padding = Math.round((sampleRate * padMs) / 1000);
  first = Math.max(0, first - padding);
  last = Math.min(samples.length, last + padding);
  return {
    samples: samples.slice(first, last),
    leadingSeconds: first / sampleRate,
    trailingSeconds: (samples.length - last) / sampleRate,
  };
}

/** RMS-normalize while respecting a true-peak ceiling. */
export function normalizeLoudness(
  samples: Float32Array,
  targetRmsDb = -18,
  peakDb = -1,
): { samples: Float32Array; gainDb: number } {
  let squareSum = 0;
  let peak = 0;
  for (const sample of samples) {
    squareSum += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const rms = Math.sqrt(squareSum / Math.max(1, samples.length));
  const wanted = 10 ** (targetRmsDb / 20) / Math.max(rms, 1e-9);
  const ceiling = 10 ** (peakDb / 20) / Math.max(peak, 1e-9);
  const gain = Math.min(wanted, ceiling, 100);
  const output = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1)
    output[i] = Math.max(-1, Math.min(1, samples[i]! * gain));
  return { samples: output, gainDb: 20 * Math.log10(gain) };
}
