import { useEffect, useRef } from 'react';
import type { AudioFeatures } from '@veel-veel/dsp';
function bars(values: number[]) {
  const peak = Math.max(0.01, ...values);
  return Array.from({ length: 64 }, (_, i) => {
    const start = Math.floor((i * values.length) / 64);
    const end = Math.max(start + 1, Math.floor(((i + 1) * values.length) / 64));
    return Math.min(1, Math.max(0, ...values.slice(start, end)) / peak);
  });
}
export function TakeComparison({
  reference,
  take,
  score,
  judges,
  name,
}: {
  reference: AudioFeatures | null;
  take: number[];
  score: number | null;
  name: string;
  judges?: { rhythm: number; melody: number; energy: number; vibe: number } | null;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [name]);
  return (
    <section ref={panel} className="take-comparison" aria-label="Take comparison">
      <div>
        <span className="room-kicker">THE REPLAY</span>
        <h2>{name}’s moment.</h2>
        <p>
          {score === null
            ? 'Listen first. The score arrives after the take.'
            : score === 0
              ? 'No audible take · 0 points. Check your microphone and try the next round.'
              : 'Voice-shape similarity · rhythm, pitch movement, energy and tone.'}
        </p>
      </div>
      <div className="comparison-tracks">
        {[
          ['Original', reference?.frames.map((f) => 10 ** f.logEnergy) ?? []],
          ['Recorded take', take],
        ].map(([label, values]) => (
          <div key={label as string}>
            <b>{label as string}</b>
            <svg viewBox="0 0 640 70" role="img" aria-label={`${label as string} loudness contour`}>
              <line x1="0" y1="35" x2="640" y2="35" stroke="#ffffff20" />
              {bars(values as number[]).map((value, i) => (
                <rect
                  key={i}
                  x={i * 10 + 1}
                  y={35 - value * 32}
                  width="6"
                  height={Math.max(1, value * 64)}
                  rx="3"
                />
              ))}
            </svg>
          </div>
        ))}
      </div>
      {score !== null && (
        <>
          <div className={`comparison-score ${score >= 80 ? 'score-celebrate' : ''}`}>
            <strong>{score}</strong>
            <span>
              / 100
              <br />
              {score >= 80 ? 'STANDING OVATION' : score < 40 ? 'TOMATO TIME' : 'KEEP THAT ENERGY'}
            </span>
          </div>
          {judges && (
            <div className="comparison-judges">
              {Object.entries(judges).map(([key, value]) => (
                <div key={key}>
                  <span>
                    {key} <b>{value}</b>
                  </span>
                  <meter min="0" max="100" value={value}>
                    {value}
                  </meter>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
