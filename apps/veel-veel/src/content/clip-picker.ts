export interface RotationClip {
  id: string;
  difficulty: number;
  defaultRotation: boolean;
  flags?: string[];
}

/** A neutral opener, followed by distinct clips that rise toward the chosen level. */
export function pickClips<T extends RotationClip>(
  clips: T[],
  rounds: number,
  difficulty: number,
): T[] {
  const eligible = clips.filter(
    (clip) =>
      clip.defaultRotation && !clip.flags?.some((flag) => ['banned', 'excluded'].includes(flag)),
  );
  const remaining = [...eligible];
  const picked: T[] = [];
  for (let round = 0; round < Math.min(rounds, remaining.length); round += 1) {
    if (round === 0) {
      picked.push(remaining.shift()!);
      continue;
    }
    const target = Math.min(5, difficulty + ((round - 1) / Math.max(1, rounds - 2)) * 1.5);
    const indexed = remaining.map((clip, index) => ({
      index,
      distance: Math.abs(clip.difficulty - target),
      variety: (index * 37 + round * 67) % remaining.length,
    }));
    indexed.sort((left, right) => left.distance - right.distance || left.variety - right.variety);
    picked.push(remaining.splice(indexed[0]!.index, 1)[0]!);
  }
  return picked;
}
