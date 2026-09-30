export const SCORING_CONFIG = {
  weights: { rhythm: 0.35, melody: 0.25, energy: 0.2, vibe: 0.2 },
  silenceRms: 0.0025,
  maxDurationRatio: 2.2,
  tempoTolerance: 0.15,
  partyCurveExponent: 0.74,
  minimumForAttempt: 36,
  identicalMinimum: 95,
  transposeToleranceSemitones: 5,
  transposeMinimum: 80,
  stretchTolerance: 0.15,
  stretchMinimum: 75,
  whiteNoiseMaximum: 25,
} as const;
