/** Windowed-sinc anti-alias downsampler and PCM16 converter used on-device. */
export function resampleMono(
  input: Float32Array,
  inputRate: number,
  outputRate = 22_050,
): Float32Array {
  if (inputRate <= 0 || outputRate <= 0) throw new Error('Sample rates must be positive');
  if (inputRate === outputRate) return input.slice();
  const ratio = inputRate / outputRate;
  const output = new Float32Array(Math.ceil(input.length / ratio));
  const radius = 16;
  const cutoff = Math.min(1, outputRate / inputRate) * 0.94;
  for (let j = 0; j < output.length; j += 1) {
    const center = j * ratio;
    let sum = 0;
    let weightSum = 0;
    const first = Math.max(0, Math.floor(center) - radius + 1);
    const last = Math.min(input.length - 1, Math.floor(center) + radius);
    for (let k = first; k <= last; k += 1) {
      const x = (k - center) * cutoff;
      const sinc = Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const phase = (k - center) / radius;
      const window =
        Math.abs(phase) > 1
          ? 0
          : 0.42 + 0.5 * Math.cos(Math.PI * phase) + 0.08 * Math.cos(2 * Math.PI * phase);
      const weight = cutoff * sinc * window;
      sum += input[k]! * weight;
      weightSum += weight;
    }
    output[j] = weightSum === 0 ? 0 : sum / weightSum;
  }
  return output;
}

export function toPcm16(input: Float32Array, maxSeconds = 8, sampleRate = 22_050): Int16Array {
  const length = Math.min(input.length, Math.floor(maxSeconds * sampleRate));
  const pcm = new Int16Array(length);
  for (let i = 0; i < length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]!));
    pcm[i] = Math.round(sample < 0 ? sample * 32_768 : sample * 32_767);
  }
  return pcm;
}

export function pcm16ToFloat(input: Int16Array): Float32Array {
  const output = new Float32Array(input.length);
  for (let i = 0; i < input.length; i += 1)
    output[i] = input[i]! / (input[i]! < 0 ? 32_768 : 32_767);
  return output;
}
