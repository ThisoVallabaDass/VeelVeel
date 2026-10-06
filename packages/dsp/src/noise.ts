/** Device-independent rumble filter and calibrated soft noise gate. Never boosts input. */
export function filterVoiceNoise(input: Float32Array, rate: number, noiseFloor = 0): Float32Array {
  const filtered = new Float32Array(input.length);
  const highPass = Math.exp(-2 * Math.PI * 40 / rate);
  const lowPass = 1 - Math.exp(-2 * Math.PI * Math.min(10000, rate * 0.45) / rate);
  let previous = 0, high = 0, low = 0;
  for (let i = 0; i < input.length; i++) {
    high = highPass * (high + input[i]! - previous);
    previous = input[i]!;
    low += lowPass * (high - low);
    filtered[i] = low;
  }
  const frame = Math.max(1, Math.round(rate * 0.02));
  const floor = Math.max(0.002, noiseFloor);
  let gain = 1, hold = 0;
  for (let start = 0; start < filtered.length; start += frame) {
    const end = Math.min(filtered.length, start + frame);
    let energy = 0;
    for (let i = start; i < end; i++) energy += filtered[i]! ** 2;
    const rms = Math.sqrt(energy / (end - start));
    if (rms > floor * 1.4) hold = 10;
    else hold = Math.max(0, hold - 1);
    const target = hold > 0 ? 1 : Math.max(0.02, Math.min(1, (rms / floor) ** 4));
    const smoothing = 1 - Math.exp(-1 / (rate * (target > gain ? 0.003 : 0.04)));
    for (let i = start; i < end; i++) { gain += (target - gain) * smoothing; filtered[i] = filtered[i]! * gain; }
  }
  return filtered;
}
