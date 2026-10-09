import { scoreTake } from './mic.js';
import type { AudioFeatures } from '@veel-veel/dsp';
self.onmessage = (
  event: MessageEvent<{ samples: Float32Array; sampleRate: number; reference: AudioFeatures; category?: string }>,
) => {
  try {
    self.postMessage({
      score: scoreTake(event.data.samples, event.data.sampleRate, event.data.reference, event.data.category),
    });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Scoring failed' });
  }
};
