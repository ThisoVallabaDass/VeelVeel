export interface AudioFeatures {
  sampleRate: number;
  hopMs: number;
  durationSeconds: number;
  frames: FeatureFrame[];
}

export interface FeatureFrame {
  timeMs: number;
  logEnergy: number;
  onset: number;
  pitchHz: number;
  voicing: number;
  centroidHz: number;
  mfcc: number[];
}

export interface ScoreBreakdown {
  total: number;
  rhythm: number;
  melody: number;
  energy: number;
  vibe: number;
  commitment: number;
  alignment: Array<[number, number]>;
  prompt?: 'mic-too-quiet' | 'flat-noise';
}

export interface DspConfig {
  targetSampleRate: number;
  frameMs: number;
  hopMs: number;
  mfccCount: number;
  melBands: number;
  minPitchHz: number;
  maxPitchHz: number;
}
