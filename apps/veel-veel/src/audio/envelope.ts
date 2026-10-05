export function takeEnvelope(samples: Float32Array) {
  const result: number[] = [];
  for (let i = 0; i < samples.length; i += 441) {
    const frame = samples.subarray(i, i + 441);
    result.push(Math.sqrt(frame.reduce((sum, x) => sum + x * x, 0) / Math.max(1, frame.length)));
  }
  return result;
}
