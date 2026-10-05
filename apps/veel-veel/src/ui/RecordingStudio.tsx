import micLogo from '../assets/veel-mic.png';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import './recording-studio.css';

export type StudioPhase = 'loading' | 'listen' | 'countdown' | 'record' | 'sent';
const copy = {
  loading: ['SETTING THE STAGE', 'Getting everyone in sync', 'Your microphone is not recording.'],
  listen: [
    '01 / LISTEN',
    'Catch every little detail.',
    'Listen to the original. Your microphone is not recording.',
  ],
  countdown: [
    '02 / GET READY',
    'Your moment is coming.',
    'Recording starts automatically after the countdown.',
  ],
  record: [
    '03 / YOUR TAKE',
    'Make some noise.',
    'Your microphone is recording. Imitate the sound now!',
  ],
  sent: [
    'TAKE COMPLETE',
    'You’re in the show.',
    'Recording stopped. Waiting for the other singers.',
  ],
};
export function RecordingStudio({
  phase,
  title,
  level,
  deadline = 0,
  duration = 1,
  participant = true,
  onFinish,
}: {
  phase: StudioPhase;
  title: string;
  level: number;
  deadline?: number;
  duration?: number;
  participant?: boolean;
  onFinish?: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [phase]);
  const [now, setNow] = useState(Date.now());
  const levelRef = useRef(level);
  levelRef.current = level;
  const [history, setHistory] = useState<number[]>([]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 70);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(
      () => setHistory((values) => [...values.slice(-47), levelRef.current]),
      80,
    );
    return () => window.clearInterval(timer);
  }, []);
  const remaining = Math.max(0, (deadline - now) / 1000);
  const recording = phase === 'record' && participant;
  const [label, heading, detail] = copy[phase];
  return (
    <section
      ref={panel}
      className={`recording-studio studio-${phase}`}
      aria-label="Recording studio"
      style={{ '--voice': Math.min(1, level * 3) } as CSSProperties}
    >
      <div className="studio-topline">
        <span>{label}</span>
        <span className="studio-badge">
          {recording
            ? '● REC · MICROPHONE ON'
            : phase === 'sent'
              ? '✓ TAKE SAVED FOR THIS ROUND'
              : '○ NOT RECORDING'}
        </span>
      </div>
      <div className="studio-content">
        <div className="studio-copy">
          <p className="studio-clip">{title}</p>
          <h2>{!participant && phase === 'record' ? 'The party is singing.' : heading}</h2>
          <p role="status">
            {!participant ? 'Watching the singers · this screen is not recording.' : detail}
          </p>
          {phase === 'record' && participant && (
            <p className={`studio-signal ${level > 0.015 ? 'signal-on' : ''}`}>
              {level > 0.015 ? '✓ Sound detected' : 'No sound detected — sing closer to your mic'}
            </p>
          )}
          <div className="studio-timer" aria-label="Seconds remaining">
            {phase === 'countdown'
              ? Math.max(1, Math.ceil(remaining))
              : phase === 'record' || phase === 'listen'
                ? remaining.toFixed(1)
                : phase === 'sent'
                  ? '✓'
                  : '…'}
            <small>{phase === 'sent' ? 'SUBMITTED' : 'SECONDS'}</small>
          </div>
        </div>
        <div className="studio-character" aria-hidden="true">
          <div className="studio-orbit" />
          <div className="studio-face">
            <i />
            <i />
            <b />
          </div>
          <img src={micLogo} alt="" />
          <div className="studio-shadow" />
        </div>
      </div>
      <div
        className="studio-wave"
        aria-label={recording ? 'Live microphone activity' : 'Sound playback activity'}
      >
        {Array.from({ length: 48 }, (_, i) => (
          <i key={i} style={{ height: `${2 + Math.min(1, history[i] ?? 0) * 96}%` }} />
        ))}
      </div>
      <div
        className="studio-progress"
        role="progressbar"
        aria-label="Take progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.max(0, Math.min(100, (1 - remaining / duration) * 100)))}
      >
        <i style={{ width: `${Math.max(0, Math.min(100, (1 - remaining / duration) * 100))}%` }} />
      </div>
      <footer>
        <span>
          {recording
            ? 'Audio stays in this round. Voice chat is muted.'
            : phase === 'sent'
              ? 'Next: everyone’s take, then the judges’ scores.'
              : 'LISTEN → GET READY → RECORD → THE REVEAL'}
        </span>
        {recording && onFinish && <button onClick={onFinish}>FINISH TAKE</button>}
      </footer>
    </section>
  );
}
