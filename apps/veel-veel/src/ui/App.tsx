import micLogo from '../assets/veel-mic.png';
import { RecordingStudio } from './RecordingStudio.js';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MicCapture, playClip, playTake, scoreTake } from '../audio/mic.js';
import { playCue } from '../audio/sfx.js';
import { judgeVoicesEnabled, setJudgeVoicesEnabled, speakJudge } from '../audio/judge-voices.js';
import type { RoastFx } from '../audio/mic.js';
import type { AudioFeatures, ScoreBreakdown } from '@veel-veel/dsp';
import { chaosCards } from '../content/chaos.js';
import { pickClips } from '../content/clip-picker.js';
import { judges, roastLines } from '../content/judges.js';
import { modes } from '../content/modes.js';
import { themes, playerTokens } from '../content/themes.js';
import { en } from '../content/strings/en.js';
import { useGame } from '../state/game.js';

interface PackClip {
  title?: string;
  id: string;
  audio: string;
  features: string;
  difficulty: number;
  durationSeconds: number;
  defaultRotation: boolean;
  flags?: string[];
}
interface Pack {
  id: string;
  title: string;
  language: string;
  region: string;
  clips: PackClip[];
}
type ScoreRow = ScoreBreakdown;
type ChaosId = (typeof chaosCards)[number]['id'];
const botNames = ['DJ Sambar', 'Mango Mani', 'Lil Auto', 'Paati Jr.'];
const roastFx: RoastFx[] = ['chipmunk', 'deep', 'megaphone', 'echo', 'reverse'];
function botRoundScore(botIndex: number, roundIndex: number) {
  return Math.round(60 + ((botIndex * 29 + roundIndex * 17 + 13) % 35));
}
function transformReference(features: AudioFeatures, chaosId?: ChaosId): AudioFeatures {
  if (chaosId === 'reverse') {
    return {
      ...features,
      frames: [...features.frames]
        .reverse()
        .map((frame, index) => ({ ...frame, timeMs: index * features.hopMs })),
    };
  }
  if (chaosId === 'double-speed') {
    const frames = features.frames
      .filter((_, index) => index % 2 === 0)
      .map((frame, index) => ({ ...frame, timeMs: index * features.hopMs }));
    return { ...features, durationSeconds: features.durationSeconds / 2, frames };
  }
  if (chaosId === 'chipmunk') {
    const rate = 1.55;
    return {
      ...features,
      durationSeconds: features.durationSeconds / rate,
      frames: features.frames.map((frame) => ({
        ...frame,
        timeMs: frame.timeMs / rate,
        pitchHz: frame.pitchHz * rate,
        centroidHz: frame.centroidHz * rate,
      })),
    };
  }
  return features;
}
function playbackForChaos(chaosId?: ChaosId) {
  if (chaosId === 'chipmunk') return { playbackRate: 1.55 };
  if (chaosId === 'double-speed') return { playbackRate: 2 };
  if (chaosId === 'reverse') return { reverse: true };
  return {};
}
const ArenaCanvas = lazy(() => import('../arena/ArenaCanvas.js'));
function ArenaPreview(props: {
  themeId: string;
  score?: number;
  active?: boolean;
  level?: number;
  reducedMotion?: boolean;
  compact?: boolean;
}) {
  if (new URLSearchParams(window.location.search).get('e2e') === '1') {
    const theme = themes[props.themeId] ?? themes.festival!;
    return (
      <div
        className={`arena-canvas arena-static-stage arena-theme-${theme.id}`}
        aria-label={`${theme.name} stage preview`}
      >
        <span className="arena-banner-copy" aria-hidden="true">
          {theme.banner}
        </span>
      </div>
    );
  }
  return (
    <Suspense fallback={<div className="arena-loading">SETTING THE STAGE…</div>}>
      <ArenaCanvas {...props} />
    </Suspense>
  );
}

function Stars({ count = 3 }: { count?: number }) {
  return (
    <span className="stars" aria-hidden="true">
      {'✦'.repeat(count)}
    </span>
  );
}
function ArcTitle({ label, eyebrow }: { label: string; eyebrow: string }) {
  return (
    <div className="arc-title">
      <span>{eyebrow}</span>
      <h1>{label}</h1>
    </div>
  );
}

export default function App() {
  const {
    screen,
    phase,
    round,
    rounds,
    scores,
    theme,
    highContrast,
    reducedMotion,
    setScreen,
    setPlayers,
    setRounds,
    startGame,
    setPhase,
    addScore,
    nextRound,
    setTheme,
    toggleContrast,
    toggleMotion,
  } = useGame();
  const [pack, setPack] = useState<Pack | null>(null);
  const [packError, setPackError] = useState('');
  const micOpening = useRef(false);
  const [mic, setMic] = useState<MicCapture | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [meter, setMeter] = useState(0);
  const [calibrated, setCalibrated] = useState(false);
  const [noiseFloor, setNoiseFloor] = useState(0.012);
  const [testSaid, setTestSaid] = useState(false);
  const [playerName, setPlayerName] = useState('You');
  const [selectedMode, setSelectedMode] = useState('mic-drop');
  const [difficulty, setDifficulty] = useState(3);
  const [chaosOn, setChaosOn] = useState(true);
  const [clip, setClip] = useState<PackClip | null>(null);
  const [reference, setReference] = useState<AudioFeatures | null>(null);
  const [score, setScore] = useState<ScoreRow | null>(null);
  const [recording, setRecording] = useState(false);
  const [lastTake, setLastTake] = useState<Float32Array | null>(null);
  const [roastEffect, setRoastEffect] = useState<RoastFx | null>(null);
  const [chaosStartIndex, setChaosStartIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [takeLevels, setTakeLevels] = useState<number[]>([]);
  const [toast, setToast] = useState('');
  const [goldenBuzzer, setGoldenBuzzer] = useState(false);
  const [themeMenu, setThemeMenu] = useState(false);
  const [arenaDemoScore, setArenaDemoScore] = useState(76);
  const [arenaDemoReaction, setArenaDemoReaction] = useState('NOD · RHYTHM LOCKED');
  const [arenaDemoActive, setArenaDemoActive] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [voiceJudges, setVoiceJudges] = useState(judgeVoicesEnabled);
  const recordingTimer = useRef<number | undefined>(undefined);
  const meterTimer = useRef<number | undefined>(undefined);
  const finishRecordingRef = useRef<() => void>(() => undefined);
  const highScores = useMemo(() => scores, [scores]);
  const gameTheme = themes[theme] ?? themes.festival!;
  const activeChaos = chaosOn ? chaosCards[(chaosStartIndex + round) % chaosCards.length] : null;
  const recordingDuration = Math.max(1, Math.min(8, clip?.durationSeconds ?? 4));
  const leaderboard = useMemo(() => {
    const bots = botNames.map((name, botIndex) => ({
      name,
      score: Array.from({ length: rounds }, (_, roundIndex) =>
        botRoundScore(botIndex, roundIndex),
      ).reduce((sum, value) => sum + value, 0),
    }));
    return [
      {
        name: playerName.trim() || 'You',
        score: highScores.reduce((sum, value) => sum + value, 0),
      },
      ...bots,
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [highScores, playerName, rounds]);
  const referenceWave = useMemo(() => {
    if (!reference?.frames.length) return [];
    const activeFrames = reference.frames.filter((frame) => frame.logEnergy > -5.5);
    const frames = activeFrames.length ? activeFrames : reference.frames;
    const min = Math.min(...frames.map((frame) => frame.logEnergy));
    const max = Math.max(...frames.map((frame) => frame.logEnergy));
    return Array.from({ length: 38 }, (_, index) => {
      const frame = frames[Math.min(frames.length - 1, Math.floor((index / 38) * frames.length))]!;
      return 18 + ((frame.logEnergy - min) / Math.max(0.15, max - min)) * 66;
    });
  }, [reference]);

  useEffect(() => {
    const toggle = (event: KeyboardEvent) => {
      if (event.key === '`' || event.key === '~') setDebugOpen((open) => !open);
    };
    window.addEventListener('keydown', toggle);
    return () => window.removeEventListener('keydown', toggle);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch('/tamil-meme/pack.json')
      .then((response) => {
        if (!response.ok) throw new Error('Pack has not been indexed yet. Run pnpm pack:index.');
        return response.json() as Promise<Pack>;
      })
      .then((data) => {
        if (alive) setPack(data);
      })
      .catch((error: unknown) => {
        if (alive) setPackError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!mic || !['setup', 'game'].includes(screen)) {
      window.clearInterval(meterTimer.current);
      return;
    }
    meterTimer.current = window.setInterval(() => setMeter(mic.meter()), 60);
    return () => window.clearInterval(meterTimer.current);
  }, [mic, screen]);

  useEffect(
    () => () => {
      window.clearTimeout(recordingTimer.current);
      window.clearInterval(meterTimer.current);
      mic?.close();
    },
    [mic],
  );

  useEffect(() => {
    if (screen !== 'game' || !pack) return;
    let cancelled = false;
    const nextClip =
      pickClips(pack.clips, rounds, difficulty)[round] ?? pack.clips[round % pack.clips.length]!;
    setClip(nextClip);
    setReference(null);
    setScore(null);
    setLastTake(null);
    setRoastEffect(null);
    setPhase('listen');
    setSeconds(0);
    fetch(`/tamil-meme/${nextClip.features}`)
      .then((response) => response.json() as Promise<AudioFeatures>)
      .then(async (features) => {
        if (cancelled) return;
        setReference(transformReference(features, activeChaos?.id));
        for (let listen = 0; listen < 2; listen += 1) {
          if (cancelled) return;
          await playClip(
            `/tamil-meme/${nextClip.audio}`,
            undefined,
            playbackForChaos(activeChaos?.id),
          );
        }
        if (!cancelled) setPhase('perform');
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setToast(error instanceof Error ? error.message : 'Sound clip could not be loaded');
          setPhase('perform');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [screen, round, rounds, difficulty, pack, setPhase, activeChaos?.id]);

  useEffect(() => {
    if (screen !== 'game' || phase !== 'perform' || !recording) return;
    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      setSeconds(Math.min(recordingDuration, (Date.now() - startedAt) / 1000));
      setTakeLevels((levels) => [...levels, mic?.meter() ?? 0]);
    }, 40);
    recordingTimer.current = window.setTimeout(
      () => finishRecordingRef.current(),
      recordingDuration * 1000,
    );
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(recordingTimer.current);
    };
  }, [screen, phase, recording, recordingDuration, mic]);

  async function openMic() {
    if (micOpening.current) return;
    micOpening.current = true;
    const capture = new MicCapture();
    try {
      await capture.open(deviceId || undefined);
      setMic(capture);
      setDevices(
        await navigator.mediaDevices
          .enumerateDevices()
          .then((all) => all.filter((item) => item.kind === 'audioinput')),
      );
      setToast('MIC IS LIVE · Your audio stays on this device');
      setTimeout(() => setToast(''), 3000);
    } catch (error) {
      capture.close();
      setToast(
        error instanceof Error
          ? error.message
          : 'Mic permission is unavailable. Open this on HTTPS.',
      );
    } finally { micOpening.current = false; }
  }

  async function calibrateNoise() {
    if (!mic) {
      await openMic();
      return;
    }
    await mic.calibrate();
    const samples: number[] = [];
    const timer = window.setInterval(() => samples.push(mic.meter()), 80);
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    window.clearInterval(timer);
    const average = samples.reduce((sum, value) => sum + value, 0) / Math.max(1, samples.length);
    setNoiseFloor(average);
    setCalibrated(true);
    setToast('Room calibrated · You can sing softly or go full festival.');
  }

  async function testVoice() {
    if (!mic) {
      await openMic();
      setToast('Mic connected. Tap TEST MY VOICE once more and say “Veel Veel!”.');
      return;
    }
    mic.start();
    setToast('Say “Veel Veel!” now — you have three seconds.');
    await new Promise((resolve) => window.setTimeout(resolve, 3000));
    const take = mic.stop();
    let energy = 0;
    for (const value of take) energy += value * value;
    const rms = Math.sqrt(energy / Math.max(1, take.length));
    if (rms < Math.max(0.003, noiseFloor * 0.13)) {
      setTestSaid(false);
      setToast('Could not hear a voice yet. Check the mic level and try again.');
    } else {
      setTestSaid(true);
      setToast('Beautifully loud. You are cleared for the stage.');
    }
  }

  async function beginSetup() {
    if (!pack?.clips.length) {
      setToast(packError || 'Sound pack is loading.');
      return;
    }
    setScreen('setup');
    if (!mic) await openMic();
  }

  function enterLobby() {
    if (!mic || !calibrated || !testSaid) {
      void openMic();
      setToast('Connect your mic, calibrate the room, and try the voice check first.');
      return;
    }
    setPlayers([
      { id: 'you', name: playerName.trim() || 'You', score: 0, bot: false },
      { id: 'bot-1', name: 'DJ Sambar', score: 0, bot: true },
      { id: 'bot-2', name: 'Mango Mani', score: 0, bot: true },
      { id: 'bot-3', name: 'Lil Auto', score: 0, bot: true },
      { id: 'bot-4', name: 'Paati Jr.', score: 0, bot: true },
    ]);
    setScreen('lobby');
  }

  async function replayReference() {
    if (!clip || recording) return;
    try {
      await playClip(`/tamil-meme/${clip.audio}`, undefined, playbackForChaos(activeChaos?.id));
    } catch {
      setToast('Sound clip could not be replayed.');
    }
  }

  function startRecording() {
    if (!mic) {
      setToast('Mic not connected. Go back to Mic Setup.');
      return;
    }
    mic.start();

    setSeconds(0);
    setTakeLevels([]);
    setRecording(true);
  }

  function finishRecording() {
    if (!recording) return;
    const samples = mic?.stop() ?? new Float32Array();
    setLastTake(new Float32Array(samples));
    setRecording(false);
    setPhase('reveal');
    const result =
      reference && mic
        ? scoreTake(samples, mic.sampleRate, reference)
        : {
            total: 0,
            rhythm: 0,
            melody: 0,
            energy: 0,
            vibe: 0,
            commitment: 0,
            alignment: [],
            prompt: 'mic-too-quiet' as const,
          };
    let scored = result;
    if (!result.prompt && activeChaos?.id === 'whisper-round') {
      const rms = Math.sqrt(
        samples.reduce((sum, sample) => sum + sample * sample, 0) / Math.max(1, samples.length),
      );
      if (rms > 0.08)
        scored = {
          ...result,
          total: Math.max(0, result.total - 15),
          energy: Math.max(0, result.energy - 20),
        };
    }
    if (!scored.prompt && activeChaos?.id === 'tomato-time') {
      const lowestBot = Math.min(...botNames.map((_, index) => botRoundScore(index, round)));
      if (scored.total < lowestBot) scored = { ...scored, total: Math.max(0, scored.total - 10) };
    }
    setScore(scored);
    playCue(scored.total >= 80 ? 'cheer' : scored.total < 30 ? 'boo' : 'gavel');
    if (voiceJudges)
      speakJudge(judges[round % judges.length]!.id as 'anna' | 'akka' | 'paati',
        scored.prompt === 'mic-too-quiet'
          ? 'We need more voice. Give it another big try!'
          : roastLines[(round * 3 + scored.total) % roastLines.length]!);
    addScore(scored.total);
    if (scored.prompt)
      setToast(
        scored.prompt === 'mic-too-quiet'
          ? 'We barely heard you — sing like the neighbors are listening!'
          : 'That sounded like a fan, not a voice. Give it a little shape!',
      );
    else setToast('THE CROWD GOES WILD');
  }
  finishRecordingRef.current = finishRecording;

  function continueRound() {
    playCue('next');
    setToast('');
    nextRound();
  }

  function beginGame() {
    playCue('start');
    setGoldenBuzzer(false);
    startGame();
  }

  function replayGame() {
    setChaosStartIndex((index) => (index + 1) % chaosCards.length);
    beginGame();
  }

  const pageClass = `app-shell${highContrast ? ' high-contrast' : ''}${reducedMotion ? ' reduce-motion' : ''}`;
  const renderTop = (right?: ReactNode) => (
    <header className="topbar">
      <button className="brand" onClick={() => setScreen('home')} aria-label="Veel Veel home">
        <img className="voice-brand-icon" src={micLogo} alt="" />
        <span>
          VEEL<span className="brand-light">VEEL</span>
          <small>THE VOICE PARTY</small>
        </span>
      </button>
      <div className="topbar-right">
        {right}
        <button
          className="sound-toggle"
          aria-label="Settings"
          onClick={() => setScreen('settings')}
        >
          ⚙ <span>SETTINGS</span>
        </button>
      </div>
    </header>
  );

  if (window.location.pathname === '/arena') {
    return (
      <main className={`${pageClass} arena-sandbox`}>
        {renderTop(<span className="room-pill">DEV SANDBOX · M1</span>)}
        <section className="sandbox-layout">
          <div className="sandbox-heading">
            <span className="micro-label">PROCEDURAL STAGE · LIVE PREVIEW</span>
            <h1>
              THE ARENA
              <br />
              <em>TEST DRIVE.</em>
            </h1>
            <p>
              Theme switches, character lights, judge reactions and crowd energy — all without
              starting a round.
            </p>
          </div>
          <div className="sandbox-controls">
            <div className="sandbox-control-row">
              <span>STAGE THEME</span>
              {Object.values(themes).map((stage) => (
                <button
                  key={stage.id}
                  className={stage.id === theme ? 'selected' : ''}
                  onClick={() => setTheme(stage.id)}
                >
                  {stage.id === 'festival' ? '🎊' : '🎬'} {stage.name}
                </button>
              ))}
            </div>
            <label className="sandbox-control-row">
              <span>CROWD SCORE · {arenaDemoScore}</span>
              <input
                type="range"
                min="0"
                max="100"
                value={arenaDemoScore}
                onChange={(event) => setArenaDemoScore(Number(event.target.value))}
              />
            </label>
            <div className="sandbox-control-row">
              <span>JUDGE REACTION</span>
              {[
                'NOD · RHYTHM LOCKED',
                'FACEPALM · OFF BEAT',
                'STANDING OVATION',
                'PAATI ROAST',
              ].map((reaction) => (
                <button
                  key={reaction}
                  className={reaction === arenaDemoReaction ? 'selected' : ''}
                  onClick={() => setArenaDemoReaction(reaction)}
                >
                  {reaction}
                </button>
              ))}
            </div>
            <div className="sandbox-control-row">
              <span>MIC INPUT</span>
              <button
                className={arenaDemoActive ? 'selected' : ''}
                onClick={() => setArenaDemoActive(!arenaDemoActive)}
              >
                {arenaDemoActive ? '● FEEDING LIVE LEVEL' : '◉ FEED FAKE LEVEL'}
              </button>
              <small>
                {arenaDemoActive
                  ? 'Mouth shapes and character bounce preview active.'
                  : 'No device microphone needed in the arena sandbox.'}
              </small>
            </div>
          </div>
          <div className="sandbox-stage">
            <ArenaPreview
              themeId={theme}
              score={arenaDemoScore}
              active={arenaDemoActive}
              reducedMotion={reducedMotion}
            />
            <div className="sandbox-reaction">
              <span>
                {arenaDemoReaction.includes('OVATION')
                  ? '✦'
                  : arenaDemoReaction.includes('ROAST')
                    ? '👵🏽'
                    : arenaDemoReaction.includes('FACEPALM')
                      ? '🤦🏽'
                      : '🥁'}
              </span>
              <b>{arenaDemoReaction}</b>
              <small>
                {gameTheme.name.toUpperCase()} · {gameTheme.crowdDensity} INSTANCED FANS
              </small>
            </div>
          </div>
          <div className="sandbox-footer">
            <a href="/?quality=low&amp;e2e=1">← BACK TO THE SHOW</a>
            <span>?quality=low&amp;e2e=1 · Reduced-motion aware</span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={pageClass}>
      {screen === 'home' && (
        <>
          {renderTop(
            <span className="pack-pill">
              <i /> {pack?.language === 'mixed' ? 'MEME MIX' : 'TAMIL PACK'} · {pack?.clips.length ?? '···'} SOUNDS
            </span>,
          )}
          <section className="home-actions">
            <button
              className="mode-link"
              onClick={() => { window.location.href = '/host'; }}
            >
              ▣ &nbsp; HOST ROOM <small>2–5 PLAYERS</small>
            </button>
            <button
              className="mode-link"
              onClick={() => { window.location.href = '/join'; }}
            >
              ⌕ &nbsp; JOIN ROOM <small>USE A CODE</small>
            </button>
            <button
              className="mode-link"
              disabled
            >
              ✦ &nbsp; DAILY STAGE <small>COMING LATER</small>
            </button>
            <button className="mode-link theme-trigger" onClick={() => setThemeMenu(!themeMenu)}>
              ◈ &nbsp; STAGE <small>{gameTheme.name.toUpperCase()}</small>
            </button>
          </section>
          <section className="home-hero">
            <div className="home-copy">
              <div className="season-tag">
                <Stars /> {pack?.language === 'mixed' ? 'TAMIL + ENGLISH MEME NIGHT' : 'TAMIL MEME NIGHT'} <Stars />
              </div>
              <h1>
                THE BIG
                <br />
                <em>VOICE</em>
                <br />
                ENERGY.
              </h1>
              <p className="lead">
                Hear the sound. Become the sound.
                <br />
                Get judged lovingly.
              </p>
              <button className="btn btn-primary btn-xl" onClick={() => void beginSetup()}>
                {en.playLocal}
                <span>↗</span>
              </button>
              <p className="privacy-note">
                <span>◉</span> LOCAL MODE: MIC STAYS ON THIS DEVICE
              </p>
              {packError && <p className="error-note">{packError}</p>}
            </div>
            <div className="hero-stage">
              <div className="stage-sticker sticker-one">
                PAATI
                <br />
                APPROVES? <span>👀</span>
              </div>
              <div className="stage-sticker sticker-two">
                SING IT
                <br />
                LIKE YOU
                <br />
                MEAN IT <span>↘</span>
              </div>
              <div className="stage-lights" />
              <ArenaPreview themeId={theme} score={74} reducedMotion={reducedMotion} />
              <div className="hero-caption">
                <span>LIVE FROM</span>
                <b>{gameTheme.name.toUpperCase()}</b>
                <i>●</i>
              </div>
            </div>
          </section>

          {themeMenu && (
            <div className="theme-popover">
              {Object.values(themes).map((stage) => (
                <button
                  key={stage.id}
                  className={stage.id === theme ? 'selected' : ''}
                  onClick={() => {
                    setTheme(stage.id);
                    setThemeMenu(false);
                  }}
                >
                  {stage.id === 'festival' ? '🎊' : '🎬'} {stage.name}
                  <small>{stage.banner}</small>
                </button>
              ))}
            </div>
          )}
          <section className="promise-row">
            <span>
              01 <b>HEAR THE CLIP</b>
            </span>
            <i />
            <span>
              02 <b>LET IT RIP</b>
            </span>
            <i />
            <span>
              03 <b>GET THE ROAST</b>
            </span>
            <Stars count={2} />
          </section>
        </>
      )}

      {screen === 'setup' && (
        <>
          {renderTop()}
          <div className="setup-layout">
            <section className="setup-card">
              <div className="back-row">
                <button onClick={() => setScreen('home')}>← BACK</button>
                <span>01 / 03 · SETUP</span>
              </div>
              <ArcTitle eyebrow="FIRST, THE IMPORTANT STUFF" label={en.micCheck} />
              <p className="section-intro">
                Get comfy. Paati can hear you. (Just kidding. Kind of.)
              </p>
              <div className="mic-device">
                <span className="device-icon">🎙</span>
                <label htmlFor="mic-device">YOUR MICROPHONE</label>
                <select
                  id="mic-device"
                  value={deviceId}
                  onChange={(event) => setDeviceId(event.target.value)}
                  aria-label="Choose microphone"
                >
                  <option value="">{mic ? 'Microphone connected' : 'Choose input device'}</option>
                  {devices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${index + 1}`}
                    </option>
                  ))}
                </select>
                <button className="text-link" onClick={() => void openMic()}>
                  {mic ? 'RECONNECT ↗' : 'CONNECT MIC ↗'}
                </button>
              </div>
              <div className="meter-panel">
                <div className="meter-heading">
                  <span>LIVE LEVEL</span>
                  <span className={meter > 0.12 ? 'live' : ''}>
                    {meter > 0.12 ? '● SOUND CHECK' : '● WAITING FOR SOUND'}
                  </span>
                </div>
                <div className="meter-bars">
                  {Array.from({ length: 36 }, (_, index) => (
                    <i
                      key={index}
                      className={meter * 36 > index ? 'lit' : ''}
                      style={{ '--i': index } as React.CSSProperties}
                    />
                  ))}
                </div>
                <div className="meter-scale">
                  <span>QUIET</span>
                  <span>PERFECT PARTY LEVEL</span>
                  <span>CLIP</span>
                </div>
                <button
                  className="text-link calibration-button"
                  onClick={() => void calibrateNoise()}
                >
                  {calibrated ? 'ROOM CALIBRATED ✓' : 'CALIBRATE ROOM NOISE ↗'}
                </button>
              </div>
              <div className="test-say">
                <span className="say-orb">{testSaid ? '✓' : 'Aa'}</span>
                <div>
                  <b>{en.sayTest}</b>
                  <small>
                    {testSaid
                      ? 'Lovely. The crowd is warmed up.'
                      : 'Say it at your normal singing volume.'}
                  </small>
                </div>
                <button
                  className={`btn ${testSaid ? 'btn-outline' : 'btn-secondary'}`}
                  onClick={() => void testVoice()}
                >
                  TEST MY VOICE <span>↗</span>
                </button>
              </div>
              <div className="privacy-box">
                <span>◉</span>
                <p>
                  <b>{en.micTip}</b>
                  <small>
                    Your take stays in memory for roast replay until the next round. It is never
                    uploaded.
                  </small>
                </p>
              </div>
              <button
                className="btn btn-primary btn-wide"
                onClick={enterLobby}
                disabled={!mic || !calibrated || !testSaid}
              >
                READY UP <span>↗</span>
              </button>
            </section>
            <aside className="setup-side">
              <div className="side-kicker">
                SOUND CHECK
                <br />
                SOUND CHECK
              </div>
              <ArenaPreview themeId={theme} score={56} compact reducedMotion={reducedMotion} />
              <div className="side-foot">
                <span>PAATI'S NOTE</span>
                <p>
                  “No need to sound perfect. Sound <em>present.</em>”
                </p>
                <b>— PAATI 👵🏽</b>
              </div>
            </aside>
          </div>
        </>
      )}

      {screen === 'lobby' && (
        <>
          {renderTop(
            <span className="room-pill">
              LOCAL PARTY <i>●</i>
            </span>,
          )}
          <div className="lobby-layout">
            <section className="lobby-main">
              <div className="back-row">
                <button onClick={() => setScreen('setup')}>← MIC SETUP</button>
                <span>THE GREEN ROOM</span>
              </div>
              <ArcTitle eyebrow="GATHER YOUR COURAGE" label="THE LINEUP" />
              <div className="seat-grid">
                {[
                  { name: playerName || 'You', role: 'YOUR MIC IS HOT', emoji: '🎤', you: true },
                  { name: 'DJ Sambar', role: 'BEAT MACHINE', emoji: '🥁' },
                  { name: 'Mango Mani', role: 'BOLD CHOICES', emoji: '🥭' },
                  { name: 'Lil Auto', role: 'TINY BUT MIGHTY', emoji: '🤖' },
                  { name: 'Paati Jr.', role: 'ROAST IN TRAINING', emoji: '👵🏽' },
                ].map((seat, index) => (
                  <div
                    className={`seat-card token-${index}${seat.you ? ' you' : ''}`}
                    key={seat.name}
                  >
                    <div className="seat-card-top">
                      <span className="seat-number">
                        <i className={`identity-mark shape-${playerTokens[index]!.shape}`} /> 0
                        {index + 1}
                      </span>
                      <span className="seat-online">● READY</span>
                    </div>
                    <div className="avatar-orb">
                      {seat.emoji}
                      <i>{seat.you ? '🎙' : ['♬', '✦', '⚡', '♡'][index - 1]}</i>
                    </div>
                    {seat.you ? (
                      <input
                        aria-label="Your player name"
                        maxLength={16}
                        value={playerName}
                        onChange={(event) => setPlayerName(event.target.value)}
                      />
                    ) : (
                      <b>{seat.name}</b>
                    )}
                    <small>{seat.role}</small>
                    <div className="mini-wave">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                ))}
              </div>
              <div className="lobby-footer">
                <span>
                  <i /> {pack?.title ?? 'TAMIL MEME PACK'} · {pack?.clips.length ?? 0} CLIPS
                </span>
                <button className="btn btn-primary" onClick={beginGame}>
                  LET'S PLAY <span>↗</span>
                </button>
              </div>
            </section>
            <aside className="lobby-options">
              <span className="micro-label">TONIGHT'S SETLIST</span>
              <h2>
                CHOOSE YOUR
                <br />
                <em>ENERGY.</em>
              </h2>
              <div className="mode-list">
                {modes.map((mode) => (
                  <button
                    className={`mode-card ${mode.tone}${selectedMode === mode.id ? ' active' : ''}${mode.comingSoon ? ' disabled' : ''}`}
                    key={mode.id}
                    onClick={() => {
                      if (!mode.comingSoon) setSelectedMode(mode.id);
                      else setToast(`${mode.name} arrives in a later milestone.`);
                    }}
                  >
                    <span>{mode.icon}</span>
                    <b>{mode.name}</b>
                    <small>{mode.subtitle}</small>
                    {mode.comingSoon ? (
                      <i>COMING SOON</i>
                    ) : selectedMode === mode.id ? (
                      <i>✓ SELECTED</i>
                    ) : null}
                  </button>
                ))}
              </div>
              <label className="field-label">
                YOUR STAGE NAME
                <input
                  aria-label="Player name"
                  maxLength={16}
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                />
              </label>
              <label className="field-label">
                ROUNDS
                <select
                  aria-label="Round count"
                  value={rounds}
                  onChange={(event) => setRounds(Number(event.target.value) as 5 | 8 | 12)}
                >
                  {[5, 8, 12].map((count) => (
                    <option key={count} value={count}>
                      {count} rounds
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                DIFFICULTY{' '}
                <select
                  value={difficulty}
                  onChange={(event) => setDifficulty(Number(event.target.value))}
                >
                  {['Warm Up', 'Easy', 'Party', 'Spicy', 'Pro'].map((name, i) => (
                    <option key={name} value={i + 1}>
                      {i + 1} · {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="switch-row">
                <span>
                  CHAOS CARDS <small>{chaosOn ? 'A LITTLE MAYHEM' : 'CLEAN SETLIST'}</small>
                </span>
                <input
                  type="checkbox"
                  checked={chaosOn}
                  onChange={(event) => setChaosOn(event.target.checked)}
                />
                <i />
              </label>
              <div className="pack-select">
                <span>♪</span>
                <p>
                  <b>{pack?.language === 'mixed' ? 'TAMIL + ENGLISH MEMES' : 'TAMIL MEMES · ta'}</b>
                  <small>{pack?.region} · UNLABELLED ID SET</small>
                </p>
                <span className="tiny-check">✓</span>
              </div>
            </aside>
          </div>
        </>
      )}

      {screen === 'game' && (
        <>
          {renderTop(
            <div className="round-counter">
              ROUND <b>{String(round + 1).padStart(2, '0')}</b>
              <i>/ {String(rounds).padStart(2, '0')}</i>
            </div>,
          )}
          <section className={`game-layout ${recording ? "is-recording" : ""}`}>
            <div className="game-heading">
              <div>
                <span className="micro-label">
                  {phase === 'listen'
                    ? 'EARS OPEN. MIC OFF.'
                    : phase === 'perform'
                      ? 'THIS IS YOUR MOMENT.'
                      : 'THE JUDGES HAVE SPOKEN.'}
                </span>
                <h1>
                  {phase === 'listen'
                    ? 'LISTEN CLOSE.'
                    : phase === 'perform'
                      ? 'GIVE US YOUR'
                      : 'THE SCORE IS IN.'}
                  <br />
                  <em>
                    {phase === 'listen'
                      ? 'CATCH THE VIBE.'
                      : phase === 'perform'
                        ? 'BEST IMPRESSION.'
                        : 'FEEL THE LOVE.'}
                  </em>
                </h1>
              </div>
              <div className="game-clip-tag">
                <span>CLIP {String(round + 1).padStart(2, '0')}</span>
                <b>DIFFICULTY {difficulty}</b>
              </div>
            </div>
            {activeChaos && (
              <div className="chaos-banner">
                <span>⚡ CHAOS CARD</span>
                <b>{activeChaos.name}</b>
                <small>{activeChaos.effect}</small>
              </div>
            )}
            <div className="game-stage">
              <ArenaPreview
                themeId={theme}
                score={score?.total ?? 68}
                active={recording}
                level={meter}
                reducedMotion={reducedMotion}
              />
              <div className="judge-rail">
                {judges.map((judge) => (
                  <div key={judge.id}>
                    <span>{judge.emoji}</span>
                    <small>{judge.role}</small>
                  </div>
                ))}
              </div>
              <div className="arena-live-card">
                <span>THE SOUND</span>
                {activeChaos?.id === 'no-peek' ? (
                  <div className="clip-wave no-peek" aria-label="Voice-shape guide hidden">
                    <span>THE GUIDE IS HIDDEN</span>
                  </div>
                ) : (
                  <div className="clip-wave" aria-label="Reference sound waveform">
                    {referenceWave.map((height, i) => (
                      <i
                        key={i}
                        style={
                          {
                            '--wave': `${height}%`,
                          } as React.CSSProperties
                        }
                      />
                    ))}
                  </div>
                )}
                {phase !== 'listen' && (
                  <svg
                    className="voice-lane"
                    viewBox="0 0 380 64"
                    role="img"
                    aria-label="Reference voice shape and your live voice shape"
                  >
                    {activeChaos?.id !== 'no-peek' && (
                      <polyline
                        className="voice-ghost"
                        points={referenceWave
                          .map((height, index) => `${(index / 37) * 380},${60 - height * 0.55}`)
                          .join(' ')}
                      />
                    )}
                    <polyline
                      className="voice-trail"
                      points={takeLevels
                        .map(
                          (level, index) =>
                            `${(index / Math.max(1, takeLevels.length - 1)) * 380},${60 - Math.min(1, level) * 52}`,
                        )
                        .join(' ')}
                    />
                  </svg>
                )}
                <button disabled={recording} onClick={() => void replayReference()}>
                  ↻ &nbsp; REPLAY CLIP
                </button>
              </div>
              <div className="player-scorebug">
                <span
                  className={`score-shape shape-${playerTokens[0]!.shape}`}
                  aria-label="Player one marker"
                />
                <b>YOU</b>
                <strong>{highScores.reduce((sum, value) => sum + value, 0)}</strong>
                <small>POINTS</small>
              </div>
            </div>
            <div className="game-action-area">
              {phase === 'listen' && (
                <div className="listen-state">
                  <div className="sound-rings">
                    <span>♫</span>
                  </div>
                  <div>
                    <b>LOCK IN THAT SOUND</b>
                    <small>The mic is off while you listen.</small>
                  </div>
                  <span className="listening-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              )}
              {phase === 'perform' && !recording && (
                <div className="perform-state">
                  <p>
                    {clip?.id ?? 'LOADING SOUND'} <span>·</span> WHEN YOU'RE READY, MAKE IT YOURS
                  </p>
                  <button
                    className="record-button"
                    aria-label="Start recording"
                    onClick={startRecording}
                  >
                    <i>●</i>
                    <b>HOLD NOTHING BACK</b>
                    <small>YOUR {recordingDuration.toFixed(1)} SECOND TAKE</small>
                  </button>
                  <button className="text-link" onClick={() => void replayReference()}>
                    NEED ANOTHER LISTEN? REPLAY ↗
                  </button>
                </div>
              )}
              {recording && <RecordingStudio phase="record" title={clip?.title ?? 'Your take'} level={meter} deadline={Date.now() + (recordingDuration - seconds) * 1000} duration={recordingDuration} onFinish={finishRecording} />}
              {phase === 'reveal' && (
                <div className="reveal-state">
                  <div className={`big-score${score && score.total > 84 ? ' score-hot' : ''}`}>
                    {score?.total ?? '—'}
                    <small> / 100</small>
                  </div>
                  <div className="judge-scores">
                    {[
                      ['RHYTHM', score?.rhythm],
                      ['MELODY', score?.melody],
                      ['ENERGY', score?.energy],
                      ['VIBE', score?.vibe],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <span>{label}</span>
                        <b>{value ?? 0}</b>
                      </div>
                    ))}
                  </div>
                  <p>
                    {score?.prompt
                      ? score.prompt === 'mic-too-quiet'
                        ? 'The crowd wants more voice. Give them a bigger take!'
                        : 'Unexpected remix. Add a little melody next time!'
                      : roastLines[(round * 3 + (score?.total ?? 0)) % roastLines.length]}
                  </p>
                  <div className="reveal-actions">
                    {lastTake && (
                      <button
                        className="btn btn-outline"
                        onClick={() => {
                          const effect = roastFx[Math.floor(Math.random() * roastFx.length)]!;
                          setRoastEffect(effect);
                          void playTake(lastTake, mic?.sampleRate ?? 22_050, effect);
                        }}
                      >
                        REPLAY THE ROAST{roastEffect ? ` · ${roastEffect.toUpperCase()}` : ''}
                      </button>
                    )}
                    {clip && (
                      <button
                        className="btn btn-outline"
                        onClick={() => {
                          const rate = [0.78, 1.22, 0.9, 1.34][round % 4]!;
                          void playClip(`/tamil-meme/${clip.audio}`, undefined, {
                            ...playbackForChaos(activeChaos?.id),
                            playbackRate:
                              rate * (playbackForChaos(activeChaos?.id).playbackRate ?? 1),
                            effect: round % 2 ? 'megaphone' : 'echo',
                          });
                        }}
                      >
                        HEAR {botNames[round % botNames.length]!.toUpperCase()}'S BOT TAKE
                      </button>
                    )}
                    {score && (
                      <button
                        className={`golden-buzzer${goldenBuzzer ? ' used' : ''}`}
                        disabled={goldenBuzzer}
                        onClick={() => {
                          const roundScore = score.total;
                          const bonusTotal =
                            roundScore >= 40
                              ? Math.min(100, roundScore * 2)
                              : Math.floor(roundScore / 2);
                          setGoldenBuzzer(true);
                          addScore(bonusTotal);
                          setScore((previous) =>
                            previous ? { ...previous, total: bonusTotal } : previous,
                          );
                          setToast(
                            roundScore >= 40
                              ? 'GOLDEN BUZZER! YOUR ROUND SCORE IS DOUBLED.'
                              : 'GOLDEN BUZZER! A SCORE UNDER 40 IS HALVED.',
                          );
                        }}
                      >
                        ✦ {goldenBuzzer ? 'USED THIS GAME' : 'GOLDEN BUZZER'}
                      </button>
                    )}
                    <button className="btn btn-primary" onClick={continueRound}>
                      {round + 1 >= rounds ? 'SEE THE PODIUM' : en.onceMore} <span>↗</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="score-trail">
              <span>YOUR RUN</span>
              {highScores.map((value, i) => (
                <div className={i === round ? 'current' : ''} key={i}>
                  <i>{i < round ? '✓' : String(i + 1).padStart(2, '0')}</i>
                  <b style={{ width: `${i <= round ? value : 0}%` }} />
                  <small>{i < round ? value : i === round ? (score?.total ?? '·') : '·'}</small>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {screen === 'results' && (
        <>
          {renderTop()}
          <section className="results-page">
            <div className="results-heading">
              <span className="micro-label">
                {leaderboard[0]?.name === (playerName.trim() || 'You')
                  ? 'THE CROWD HAS A NEW FAVOURITE'
                  : 'A FESTIVAL NIGHT TO REMEMBER'}
              </span>
              <h1>
                ABSOLUTE
                <br />
                <em>LEGENDS.</em>
              </h1>
              <p>
                {rounds} sounds. {rounds} attempts. One unforgettable night.
              </p>
            </div>
            <div className="podium-scene">
              <ArenaPreview
                themeId={theme}
                score={Math.round(highScores.reduce((sum, value) => sum + value, 0) / rounds)}
                reducedMotion={reducedMotion}
              />
              <div className="podium">
                {[leaderboard[1]!, leaderboard[0]!, leaderboard[2]!].map((player, index) => (
                  <div
                    className={`podium-place ${['second', 'first', 'third'][index]}`}
                    key={player.name}
                  >
                    <span>{['🥈', '🏆', '🥉'][index]}</span>
                    <b>{player.name.toUpperCase()}</b>
                    <small>{player.score} PTS</small>
                    {index === 1 && <i>MIC DROP CHAMPION</i>}
                  </div>
                ))}
              </div>
            </div>
            <div className="award-row">
              <span>✦ TOP SCORE · {leaderboard[0]?.name.toUpperCase()}</span>
              <span>⚡ PERSONAL BEST · {Math.max(...highScores)} PTS</span>
              <span>♡ FIVE ROUNDS COMPLETE</span>
            </div>
            <div className="results-actions">
              <button className="btn btn-primary" onClick={replayGame}>
                RUN IT BACK ↗
              </button>
              <button
                className="btn btn-outline"
                onClick={() => {
                  setScreen('home');
                  setToast('');
                }}
              >
                BACK TO THE STAGE
              </button>
              <button
                className="btn btn-outline"
                onClick={() =>
                  setToast('Your share card is ready to screenshot — it never includes audio.')
                }
              >
                SHARE THE ROAST ↗
              </button>
            </div>
          </section>
        </>
      )}

      {screen === 'settings' && (
        <>
          {renderTop()}
          <section className="settings-page">
            <div className="back-row">
              <button onClick={() => setScreen('home')}>← BACK TO STAGE</button>
              <span>MAKE IT YOURS</span>
            </div>
            <ArcTitle eyebrow="THE LITTLE THINGS" label="SETTINGS" />
            <div className="settings-grid">
              <button onClick={toggleContrast}>
                <span>◐</span>
                <b>HIGH CONTRAST</b>
                <small>Make stage details easier to read.</small>
                <i>{highContrast ? 'ON ✓' : 'OFF'}</i>
              </button>
              <button onClick={toggleMotion}>
                <span>⌁</span>
                <b>REDUCED MOTION</b>
                <small>Keep the show calm and comfy.</small>
                <i>{reducedMotion ? 'ON ✓' : 'OFF'}</i>
              </button>
              <button onClick={() => {
                const next = !voiceJudges;
                setVoiceJudges(next);
                setJudgeVoicesEnabled(next);
              }}>
                <span>♬</span>
                <b>JUDGE VOICES</b>
                <small>Let Anna, Akka and Paati speak their verdicts.</small>
                <i>{voiceJudges ? 'ON ✓' : 'OFF'}</i>
              </button>
              <div>
                <span>♪</span>
                <b>YOUR SOUND PACK</b>
                <small>
                  {pack?.title ?? 'Tamil meme clips'} · {pack?.clips.length ?? 0} IDs
                </small>
                <i>READY ✓</i>
              </div>
              <div>
                <span>◉</span>
                <b>ON DEVICE PRIVACY</b>
                <small>Microphone is only used for local scoring.</small>
                <i>ALWAYS ON ✓</i>
              </div>
            </div>
            <div className="settings-note">
              Keyboard friendly · Captions always on · Tamil text enabled <span>↗</span>
            </div>
          </section>
        </>
      )}

      {screen === 'home' && (
        <footer className="site-footer">
          <span>VEEL VEEL® · SING WITH YOUR WHOLE CHEST</span>
          <span>
            BUILT FOR A BIG LOUD ROOM <b>✦</b>
          </span>
        </footer>
      )}
      {toast && (
        <div role="status" className="toast">
          {toast}
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            ×
          </button>
        </div>
      )}
      <div className="screenreader" aria-live="polite">
        {screen === 'game'
          ? `Round ${round + 1}. ${phase}. ${score ? `${score.total} points` : ''}`
          : ''}
      </div>
      {screen === 'game' && debugOpen && (
        <aside className="debug-overlay" aria-label="Scoring diagnostics">
          <b>DSP DIAGNOSTICS · PRESS ~ TO CLOSE</b>
          <pre>
            {JSON.stringify(
              {
                clip: clip?.id,
                frames: reference?.frames.length,
                sampleRate: reference?.sampleRate,
                hopMs: reference?.hopMs,
                micLevel: Number(meter.toFixed(3)),
                score,
                alignmentSteps: score?.alignment.length,
              },
              null,
              2,
            )}
          </pre>
        </aside>
      )}
    </main>
  );
}
