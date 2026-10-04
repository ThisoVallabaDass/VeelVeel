import { expect, test } from 'vitest';
import { pickClips } from './clip-picker.js';

test('silent and tiny clips cannot enter a setlist even from an older manifest', () => {
  const make = (id: string, durationSeconds: number) => ({ id, durationSeconds, difficulty: 1, defaultRotation: true });
  const result = pickClips([make('silent', 0), make('tiny', 0.1), make('vocal', 2), make('phrase', 3)], 5, 1);
  expect(result.map((clip) => clip.id)).toEqual(['vocal', 'phrase']);
});
