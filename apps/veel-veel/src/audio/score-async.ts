import type { AudioFeatures, ScoreBreakdown } from '@veel-veel/dsp';
/** DSP must not block the host's capture timer, voice meter or replay animation. */
export function scoreTakeAsync(
  samples: Float32Array,
  sampleRate: number,
  reference: AudioFeatures,
  category = '',
): Promise<ScoreBreakdown> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./score-worker.ts', import.meta.url), { type: 'module' });
    const finish = () => {
      window.clearTimeout(timer);
      worker.terminate();
    };
    const timer = window.setTimeout(() => {
      finish();
      reject(new Error('Scoring timed out'));
    }, 45000);
    worker.onmessage = (event: MessageEvent<{ score?: ScoreBreakdown; error?: string }>) => {
      finish();
      if (event.data.score) resolve(event.data.score);
      else reject(new Error(event.data.error ?? 'Scoring failed'));
    };
    worker.onerror = () => {
      finish();
      reject(new Error('Scoring worker failed'));
    };
    worker.postMessage({ samples, sampleRate, reference, category });
  });
}
