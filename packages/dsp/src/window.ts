/** Periodic-free Hann taper; reduces spectral leakage on each analysis frame. */
export function hann(size: number): Float32Array {
  const out = new Float32Array(size);
  for (let i = 0; i < size; i += 1) {
    out[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / Math.max(1, size - 1));
  }
  return out;
}

export function nextPowerOfTwo(value: number): number {
  let size = 1;
  while (size < value) size *= 2;
  return size;
}

/** In-place radix-2 Cooley–Tukey FFT. The inverse path divides by N. */
export function fft(real: Float64Array, imag: Float64Array, inverse = false): void {
  const n = real.length;
  if (n !== imag.length || (n & (n - 1)) !== 0)
    throw new Error('FFT arrays must be equal power-of-two lengths');
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j]!, real[i]!];
      [imag[i], imag[j]] = [imag[j]!, imag[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / len;
    const stepR = Math.cos(angle);
    const stepI = Math.sin(angle);
    for (let start = 0; start < n; start += len) {
      let wr = 1;
      let wi = 0;
      for (let j = 0; j < len / 2; j += 1) {
        const even = start + j;
        const odd = even + len / 2;
        const oddR = real[odd]! * wr - imag[odd]! * wi;
        const oddI = real[odd]! * wi + imag[odd]! * wr;
        const evenR = real[even]!;
        const evenI = imag[even]!;
        real[even] = evenR + oddR;
        imag[even] = evenI + oddI;
        real[odd] = evenR - oddR;
        imag[odd] = evenI - oddI;
        const nextR = wr * stepR - wi * stepI;
        wi = wr * stepI + wi * stepR;
        wr = nextR;
      }
    }
  }
  if (inverse)
    for (let i = 0; i < n; i += 1) {
      real[i] = real[i]! / n;
      imag[i] = imag[i]! / n;
    }
}
