import { expect, it } from 'vitest';
import { clientRoomMessageSchema } from './index.js';

it('accepts all advertised set lengths and the fifteenth round', () => {
  const clip = { id: 'test', audio: 'clips/test.wav', features: 'features/test.json', durationSeconds: 2 };
  for (const rounds of [5, 7, 10, 15]) {
    expect(clientRoomMessageSchema.safeParse({ type: 'round:begin', mode: 'together', round: rounds - 1, rounds, clip }).success).toBe(true);
  }
  expect(clientRoomMessageSchema.safeParse({ type: 'round:loaded', round: 15 }).success).toBe(false);
});
