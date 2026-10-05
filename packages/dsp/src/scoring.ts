import { SCORING_CONFIG } from './scoring.config.js';
import type { AudioFeatures, FeatureFrame, ScoreBreakdown } from './types.js';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 0;
};
const energyOf = (frame: FeatureFrame) => 10 ** frame.logEnergy;
const normalized = (values: number[]) => {
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const deviation =
    Math.sqrt(
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length),
    ) || 1;
  return values.map((value) => (value - mean) / deviation);
};
function dtw(a: number[][], b: number[][], distance: (x: number[], y: number[]) => number) {
  if (!a.length || !b.length) return { cost: 1, path: [] as Array<[number, number]> };
  const rows = a.length + 1;
  const cols = b.length + 1;
  const costs = Array.from({ length: rows }, () =>
    new Float64Array(cols).fill(Number.POSITIVE_INFINITY),
  );
  const back = Array.from({ length: rows }, () => new Uint8Array(cols));
  costs[0]![0] = 0;
  for (let i = 1; i < rows; i += 1) {
    const center = (i / a.length) * b.length;
    for (
      let j = Math.max(1, Math.floor(center - b.length * 0.35));
      j <= Math.min(b.length, Math.ceil(center + b.length * 0.35));
      j += 1
    ) {
      const options = [costs[i - 1]![j - 1]!, costs[i - 1]![j]!, costs[i]![j - 1]!];
      let choice = 0;
      if (options[1]! < options[choice]!) choice = 1;
      if (options[2]! < options[choice]!) choice = 2;
      costs[i]![j] = options[choice]! + distance(a[i - 1]!, b[j - 1]!);
      back[i]![j] = choice;
    }
  }
  let i = a.length;
  let j = b.length;
  const path: Array<[number, number]> = [];
  while (i > 0 && j > 0) {
    path.push([i - 1, j - 1]);
    const step = back[i]![j]!;
    if (step === 0) {
      i -= 1;
      j -= 1;
    } else if (step === 1) i -= 1;
    else j -= 1;
  }
  path.reverse();
  return { cost: costs[a.length]![b.length]! / Math.max(1, path.length), path };
}
const vectorDistance = (x: number[], y: number[]) =>
  Math.sqrt(
    x.reduce((sum, value, i) => sum + (value - (y[i] ?? 0)) ** 2, 0) / Math.max(1, x.length),
  );

/** Pick the best circular phase when a continuous input device starts mid-reference cycle. */
function bestCircularOffset(reference: FeatureFrame[], take: FeatureFrame[]) {
  const length = Math.min(reference.length, take.length);
  if (length < 8 || Math.abs(reference.length - take.length) / length > 0.03) return 0;
  const refEnergy = normalized(reference.map((frame) => frame.logEnergy));
  const takeEnergy = normalized(take.map((frame) => frame.logEnergy));
  const refOnset = normalized(reference.map((frame) => frame.onset));
  const takeOnset = normalized(take.map((frame) => frame.onset));
  let bestOffset = 0;
  let bestCorrelation = Number.NEGATIVE_INFINITY;
  for (let offset = 0; offset < length; offset += 1) {
    let correlation = 0;
    for (let index = 0; index < length; index += 1) {
      const refIndex = Math.floor((((index + offset) % length) * reference.length) / length);
      const takeIndex = Math.floor((index * take.length) / length);
      correlation +=
        refEnergy[refIndex]! * takeEnergy[takeIndex]! +
        0.35 * refOnset[refIndex]! * takeOnset[takeIndex]!;
    }
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }
  return bestOffset;
}

/** Forgiving, relative performance score. This compares features only; no speech recognition. */
export function scoreFeatures(reference: AudioFeatures, take: AudioFeatures): ScoreBreakdown {
  const got = take.frames;
  const offset = bestCircularOffset(reference.frames, got);
  const frameOffset = Math.round((offset * reference.frames.length) / Math.max(1, got.length));
  const ref =
    frameOffset === 0
      ? reference.frames
      : [...reference.frames.slice(frameOffset), ...reference.frames.slice(0, frameOffset)];
  const active = got.filter((frame) => energyOf(frame) > SCORING_CONFIG.silenceRms);
  const meanRms =
    active.reduce((sum, frame) => sum + energyOf(frame), 0) / Math.max(1, active.length);
  if (active.length < Math.max(12, got.length * 0.08) || meanRms < 0.006) {
    return {
      total: 0,
      rhythm: 0,
      melody: 0,
      energy: 0,
      vibe: 0,
      commitment: 0,
      alignment: [],
      prompt: 'mic-too-quiet',
    };
  }
  const activeEnergyMedian = median(active.map((frame) => frame.logEnergy));
  const variance =
    active.reduce((sum, frame) => sum + (frame.logEnergy - activeEnergyMedian) ** 2, 0) /
    active.length;
  const spectralSpread = active.reduce((sum, frame) => sum + frame.centroidHz, 0) / active.length;
  const flatNoise =
    variance < 0.015 &&
    spectralSpread > 1800 &&
    active.filter((f) => f.voicing > 0.45).length < active.length * 0.08;
  if (flatNoise)
    return {
      total: 18,
      rhythm: 18,
      melody: 18,
      energy: 18,
      vibe: 18,
      commitment: 18,
      alignment: [],
      prompt: 'flat-noise',
    };

  const refEnergy = ref.map((frame) => frame.logEnergy);
  const takeEnergy = got.map((frame) => frame.logEnergy);
  const energyDtw = dtw(
    normalized(refEnergy).map((x) => [x]),
    normalized(takeEnergy).map((x) => [x]),
    vectorDistance,
  );
  const onsetDtw = dtw(
    ref.map((frame) => [frame.onset]),
    got.map((frame) => [frame.onset]),
    vectorDistance,
  );
  const rhythm = clamp(100 * Math.exp(-2.6 * energyDtw.cost - 1.8 * onsetDtw.cost));
  const refPitches = ref.filter((frame) => frame.pitchHz > 0 && frame.voicing > 0.35);
  const takePitches = got.filter((frame) => frame.pitchHz > 0 && frame.voicing > 0.35);
  let melody = !refPitches.length && !takePitches.length ? 90 : 48;
  if (refPitches.length && takePitches.length) {
    const refMedian = median(refPitches.map((frame) => Math.log2(frame.pitchHz)));
    const takeMedian = median(takePitches.map((frame) => Math.log2(frame.pitchHz)));
    const refContour = refPitches.map((frame) => [Math.log2(frame.pitchHz) - refMedian]);
    const takeContour = takePitches.map((frame) => [Math.log2(frame.pitchHz) - takeMedian]);
    const pitchCost = dtw(refContour, takeContour, vectorDistance).cost;
    melody = clamp(100 * Math.exp(-1.8 * pitchCost));
  }
  const energySimilarity = clamp(100 * Math.exp(-2.3 * energyDtw.cost));
  const refMfcc = ref.map((frame) => frame.mfcc.slice(1, 8));
  const takeMfcc = got.map((frame) => frame.mfcc.slice(1, 8));
  const vibeCost = dtw(refMfcc, takeMfcc, vectorDistance).cost;
  const vibe = clamp(100 * Math.exp(-vibeCost * 0.12));
  // When one device cannot track the source pitch, corroborating timbre and
  // energy contours can still recognize the same voice shape.
  if (
    (!refPitches.length || !takePitches.length) &&
    vibe >= 90 &&
    energySimilarity >= 75 &&
    rhythm >= 65
  )
    melody = Math.max(melody, (vibe + energySimilarity) / 2);
  const referenceActivity =
    ref.filter((frame) => energyOf(frame) > SCORING_CONFIG.silenceRms).length /
    Math.max(1, ref.length);
  const takeActivity = active.length / Math.max(1, got.length);
  const coverage = clamp(100 - Math.abs(referenceActivity - takeActivity) * 180);
  const durationFit = Math.exp(
    -Math.abs(
      Math.log(Math.max(0.25, take.durationSeconds) / Math.max(0.25, reference.durationSeconds)),
    ) * 0.45,
  );
  const commitment = clamp(coverage * durationFit);
  const weighted = clamp(
    rhythm * SCORING_CONFIG.weights.rhythm +
      melody * SCORING_CONFIG.weights.melody +
      energySimilarity * SCORING_CONFIG.weights.energy +
      vibe * SCORING_CONFIG.weights.vibe,
  );
  const partyLift = 100 * Math.pow(weighted / 100, SCORING_CONFIG.partyCurveExponent);
  // A single held note can match the rhythm and timbre of a changing melody.
  // Apply this ceiling only when both signals contain enough reliable pitch;
  // noisy spoken memes should still be judged on rhythm, energy and tone.
  let pitchCeiling = 100;
  if (refPitches.length >= ref.length * 0.3 && takePitches.length >= got.length * 0.3) {
    const refMedian = median(refPitches.map((frame) => Math.log2(frame.pitchHz)));
    const takeMedian = median(takePitches.map((frame) => Math.log2(frame.pitchHz)));
    const refMotion = median(refPitches.map((frame) => Math.abs(Math.log2(frame.pitchHz) - refMedian)));
    const takeMotion = median(takePitches.map((frame) => Math.abs(Math.log2(frame.pitchHz) - takeMedian)));
    if (refMotion > 0.055 && takeMotion / refMotion < 0.45)
      pitchCeiling = clamp(65 + (takeMotion / refMotion) * 35);
  }
  return {
    total: Math.round(Math.min(pitchCeiling, partyLift * (0.88 + (0.12 * commitment) / 100))),
    rhythm: Math.round(rhythm),
    melody: Math.round(melody),
    energy: Math.round(energySimilarity),
    vibe: Math.round(vibe),
    commitment: Math.round(commitment),
    alignment: dtw(
      refEnergy.map((x) => [x]),
      takeEnergy.map((x) => [x]),
      vectorDistance,
    ).path,
  };
}
