/** Reject empty takes before trimming can turn a click into a whole performance. */
export function hasAudibleTake(samples: Float32Array, rate: number, noiseFloor = 0): boolean {
  const frame = Math.max(1, Math.round(rate * 0.02));
  const threshold = Math.max(0.006, noiseFloor * 2.8);
  let activeSamples = 0;
  for (let start = 0; start < samples.length; start += frame) {
    const end = Math.min(samples.length, start + frame);
    let mean = 0;
    for (let i = start; i < end; i++) mean += samples[i]!;
    mean /= end - start;
    let energy = 0;
    for (let i = start; i < end; i++) energy += (samples[i]! - mean) ** 2;
    if (Math.sqrt(energy / (end - start)) > threshold) activeSamples += end - start;
  }
  return activeSamples >= rate * 0.12 && activeSamples >= samples.length * 0.08;
}
