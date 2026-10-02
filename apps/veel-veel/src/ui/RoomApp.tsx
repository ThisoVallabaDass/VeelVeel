import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import * as QRCode from 'qrcode';
import type { AudioFeatures, ScoreBreakdown } from '@veel-veel/dsp';
import { pcm16ToFloat, resampleMono, toPcm16, trimSilence } from '@veel-veel/dsp';
import { ROOM_VERSION, serverRoomMessageSchema } from '@veel-veel/protocol';
import type { ClientRoomMessage, ServerRoomMessage } from '@veel-veel/protocol';
import { MicCapture, playClip, scoreTake } from '../audio/mic.js';
import { playCue } from '../audio/sfx.js';
import { speakJudge } from '../audio/judge-voices.js';
import { pickClips } from '../content/clip-picker.js';
import { playerTokens } from '../content/themes.js';
import './room.css';

interface PackClip {
  id: string;
  audio: string;
  features: string;
  difficulty: number;
  durationSeconds: number;
  defaultRotation: boolean;
  flags?: string[];
}
interface Pack { clips: PackClip[]; title: string }
type RoomPlayer = Extract<ServerRoomMessage, { type: 'room:snapshot' }>['players'][number];
type RoomClip = Extract<ServerRoomMessage, { type: 'round:begin' }>['clip'];
const audioUrl = (path: string) => `/tamil-meme/${path}`;
const ArenaCanvas = lazy(() => import('../arena/ArenaCanvas.js'));
const wsUrl = () => location.port === '5173'
  ? `wss://${location.hostname}:8787/room`
  : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/room`;

function encodePcm(pcm: Int16Array) {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192)
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return btoa(binary);
}
function decodePcm(encoded: string) {
  const binary = atob(encoded);
  if (binary.length % 2 || binary.length > 352_800) throw new Error('Invalid take length');
  const view = new DataView(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) view.setUint8(index, binary.charCodeAt(index));
  const pcm = new Int16Array(binary.length / 2);
  for (let index = 0; index < pcm.length; index += 1) pcm[index] = view.getInt16(index * 2, true);
  return pcm16ToFloat(pcm);
}

export default function RoomApp() {
  const host = location.pathname === '/host';
  const pathCode = /^\/j\/([A-Z]{4})$/i.exec(location.pathname)?.[1]?.toUpperCase() ?? '';
  const [pack, setPack] = useState<Pack | null>(null);
  const [status, setStatus] = useState<'offline' | 'connecting' | 'connected'>('offline');
  const [hasSavedRoom, setHasSavedRoom] = useState(Boolean(sessionStorage.getItem(host ? 'veel-room-host' : 'veel-room-player')));
  const [code, setCode] = useState(pathCode);
  const [shareOrigin, setShareOrigin] = useState(location.origin);
  const [shareChoices, setShareChoices] = useState<{ label: string; origin: string }[]>([]);
  const [inviteQr, setInviteQr] = useState('');
  const [inputCode, setInputCode] = useState(pathCode);
  const [name, setName] = useState(host ? 'Host' : '');
  const [playerId, setPlayerId] = useState('');
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [hostConnected, setHostConnected] = useState(true);
  const [phase, setPhase] = useState<'lobby' | 'perform' | 'reveal' | 'results'>('lobby');
  const [round, setRound] = useState<number | null>(null);
  const [rounds, setRounds] = useState<5 | 8 | 12>(5);
  const [mode, setMode] = useState<'together' | 'turns'>('together');
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [clip, setClip] = useState<RoomClip | null>(null);
  const [mic, setMic] = useState<MicCapture | null>(null);
  const [level, setLevel] = useState(0);
  const [recording, setRecording] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [scores, setScores] = useState<Record<string, ScoreBreakdown>>({});
  const [liveLevels, setLiveLevels] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const socketRef = useRef<WebSocket | null>(null);
  const micRef = useRef<MicCapture | null>(null);
  const clipRef = useRef<RoomClip | null>(null);
  const referenceRef = useRef<AudioFeatures | null>(null);
  const roundRef = useRef<number | null>(null);
  const recordTimer = useRef<number | undefined>(undefined);
  const meterTimer = useRef<number | undefined>(undefined);
  const finishRef = useRef<() => void>(() => undefined);
  const identityRef = useRef(false);
  const pendingRejoinRef = useRef(false);
  const roomKey = host ? 'veel-room-host' : 'veel-room-player';
  const joinUrl = code ? `${shareOrigin}/j/${code}` : '';
  const me = players.find((player) => player.id === playerId);
  const activePlayer = players.find((player) => player.id === activePlayerId);
  const myTurn = Boolean(me?.ready) && (mode === 'together' || activePlayerId === playerId);
  const loudest = players.reduce((best, player) =>
    (liveLevels[player.id] ?? 0) > (liveLevels[best?.id ?? ''] ?? 0) ? player : best,
    undefined as RoomPlayer | undefined);
  const stageLevel = loudest ? liveLevels[loudest.id] ?? 0 : 0;

  useEffect(() => {
    if (!host || !joinUrl) return;
    let cancelled = false;
    QRCode.toDataURL(joinUrl, {
      width: 192,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#090a20', light: '#fff8ed' },
    }).then((url) => { if (!cancelled) setInviteQr(url); })
      .catch(() => { if (!cancelled) setInviteQr(''); });
    return () => { cancelled = true; };
  }, [host, joinUrl]);

  useEffect(() => {
    if (!host || !['localhost', '127.0.0.1'].includes(location.hostname)) return;
    fetch('/dev/lan-url').then((response) => response.ok ? response.json() as Promise<{ origins: { label: string; origin: string }[] }> : null)
      .then((data) => {
        if (!data?.origins?.length) return;
        setShareChoices(data.origins);
        setShareOrigin(data.origins[0]!.origin);
      })
      .catch(() => undefined);
  }, [host]);
  useEffect(() => {
    fetch('/tamil-meme/pack.json')
      .then((response) => {
        if (!response.ok) throw new Error('Sound pack is unavailable. Run pnpm pack:index.');
        return response.json() as Promise<Pack>;
      })
      .then(setPack)
      .catch((reason: unknown) => setError(String(reason)));
  }, []);
  useEffect(() => {
    const stored = sessionStorage.getItem(roomKey);
    if (!stored) return;
    let timer: number | undefined;
    try {
      const saved = JSON.parse(stored) as { code: string; token: string };
      if (!pathCode || pathCode === saved.code || host)
        timer = window.setTimeout(() => connect({ type: 'room:rejoin', code: saved.code, token: saved.token }), 0);
    } catch { sessionStorage.removeItem(roomKey); }
    return () => { window.clearTimeout(timer); socketRef.current?.close(); };
    // The room identity is fixed when this route mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => {
    window.clearTimeout(recordTimer.current);
    window.clearInterval(meterTimer.current);
    micRef.current?.close();
    socketRef.current?.close();
  }, []);
  useEffect(() => {
    if (!mic) return;
    meterTimer.current = window.setInterval(() => {
      const value = mic.meter();
      setLevel(value);
      if (recording && roundRef.current !== null)
        send({ type: 'take:level', round: roundRef.current, level: value });
    }, 70);
    return () => window.clearInterval(meterTimer.current);
  }, [mic, recording]);

  function send(message: ClientRoomMessage) {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return false;
    socketRef.current.send(JSON.stringify(message));
    return true;
  }
  async function loadReference(nextClip: RoomClip) {
    try {
      const response = await fetch(audioUrl(nextClip.features));
      if (!response.ok) throw new Error('Reference features could not load');
      const features = (await response.json()) as AudioFeatures;
      if (clipRef.current?.id === nextClip.id) referenceRef.current = features;
    } catch (reason) { setError(String(reason)); }
  }
  async function scoreIncoming(message: Extract<ServerRoomMessage, { type: 'take:submit' }>) {
    if (!host || !clipRef.current || message.round !== roundRef.current) return;
    if (!referenceRef.current) await loadReference(clipRef.current);
    if (!referenceRef.current) return;
    try {
      const result = scoreTake(decodePcm(message.pcm16), 22_050, referenceRef.current);
      playCue(result.total >= 80 ? 'cheer' : result.total < 30 ? 'boo' : 'gavel');
      setScores((previous) => ({ ...previous, [message.playerId]: result }));
      send({ type: 'round:score', round: message.round, playerId: message.playerId, score: result.total,
        judges: { rhythm: result.rhythm, melody: result.melody, energy: result.energy, vibe: result.vibe } });
    } catch { setError('A phone sent an unreadable take. Ask the singer to reconnect.'); }
  }
  function handleMessage(message: ServerRoomMessage) {
    if (message.type === 'room:error') {
      setError(message.message);
      if (pendingRejoinRef.current) {
        sessionStorage.removeItem(roomKey);
        setHasSavedRoom(false);
        pendingRejoinRef.current = false;
      }
      if (!identityRef.current) { setStatus('offline'); socketRef.current?.close(); }
      return;
    }
    if (message.type === 'room:closed') {
      setError('The room was closed.');
      identityRef.current = false;
      sessionStorage.removeItem(roomKey);
      setHasSavedRoom(false);
      setStatus('offline');
      return;
    }
    if (message.type === 'room:created' || message.type === 'room:joined') {
      if (message.version !== ROOM_VERSION) { setError('Room version mismatch. Refresh the app.'); return; }
      pendingRejoinRef.current = false;
      setCode(message.code);
      identityRef.current = true;
      if (message.type === 'room:joined') setPlayerId(message.playerId);
      sessionStorage.setItem(roomKey, JSON.stringify({ code: message.code, token: message.token }));
      setHasSavedRoom(true);
      setStatus('connected');
      setError('');
      return;
    }
    if (message.type === 'room:snapshot') {
      setPlayers(message.players);
      if (host) setPlayerId(message.players.find((player) => player.hostPlayer)?.id ?? '');
      setHostConnected(message.hostConnected);
      setPhase(message.phase === 'listen' ? 'perform' : message.phase);
      setRound(message.round);
      setRounds(message.rounds);
      if (!host || message.phase !== 'lobby') setMode(message.mode);
      setActivePlayerId(message.activePlayerId);
      roundRef.current = message.round;
      if (message.clip && message.clip.id !== clipRef.current?.id) {
        clipRef.current = message.clip;
        setClip(message.clip);
        if (host) void loadReference(message.clip);
      }
      return;
    }
    if (message.type === 'round:begin') {
      clipRef.current = message.clip;
      referenceRef.current = null;
      roundRef.current = message.round;
      setClip(message.clip);
      setRound(message.round);
      setRounds(message.rounds);
      setMode(message.mode);
      setActivePlayerId(null);
      setPhase('perform');
      setScores({});
      setSubmitted(false);
      if (host) void loadReference(message.clip);
      return;
    }
    if (message.type === 'take:submit') { void scoreIncoming(message); return; }
    if (message.type === 'take:level') {
      setLiveLevels((previous) => ({ ...previous, [message.playerId]: message.level }));
      return;
    }
    if (message.type === 'round:score') {
      setLiveLevels((previous) => ({ ...previous, [message.playerId]: 0 }));
      return;
    }
    if (message.type === 'round:reveal') {
      setPhase('reveal');
      if (host) speakJudge('paati', 'The judges have spoken. Look at that scoreboard!');
      return;
    }
    if (message.type === 'round:finish') { setPhase('results'); return; }
  }
  function connect(first: ClientRoomMessage) {
    if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) return;
    identityRef.current = false;
    pendingRejoinRef.current = first.type === 'room:rejoin';
    setStatus('connecting');
    setError('');
    const socket = new WebSocket(wsUrl());
    socketRef.current = socket;
    socket.onopen = () => socket.send(JSON.stringify(first));
    socket.onmessage = (event: MessageEvent<string>) => {
      let parsed: unknown;
      try { parsed = JSON.parse(event.data); } catch { return setError('Invalid relay response.'); }
      const result = serverRoomMessageSchema.safeParse(parsed);
      if (result.success) handleMessage(result.data);
      else setError('Room protocol mismatch. Refresh the app.');
    };
    socket.onerror = () => setError('Could not reach the room server. Run pnpm dev.');
    socket.onclose = () => {
      setStatus('offline');
      if (socketRef.current === socket) socketRef.current = null;
    };
  }
  function createRoom() { connect({ type: 'room:create' }); }
  function joinHostSinger() {
    if (!name.trim()) return setError('Add your stage name first.');
    send({ type: 'room:host-player', name: name.trim() });
  }
  function reconnect() {
    const saved = sessionStorage.getItem(roomKey);
    if (!saved) return setHasSavedRoom(false);
    try {
      const identity = JSON.parse(saved) as { code: string; token: string };
      connect({ type: 'room:rejoin', code: identity.code, token: identity.token });
    } catch { sessionStorage.removeItem(roomKey); setHasSavedRoom(false); }
  }
  function joinRoom() {
    const normalized = inputCode.trim().toUpperCase();
    if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/.test(normalized)) return setError('Enter a four letter room code.');
    if (!name.trim()) return setError('Add your stage name first.');
    connect({ type: 'room:join', code: normalized, name: name.trim() });
  }
  async function openMic() {
    if (micRef.current) return;
    const capture = new MicCapture();
    try {
      await capture.open();
      micRef.current = capture;
      setMic(capture);
      setError('');
    } catch (reason) { capture.close(); setError(`Mic unavailable: ${String(reason)}`); }
  }
  async function beginRound() {
    if (!pack) return setError('The sound pack is loading.');
    const next = round === null ? 0 : round + 1;
    if (next >= rounds) { send({ type: 'round:finish' }); return; }
    const selection = pickClips(pack.clips, rounds, 3)[next];
    if (!selection) return setError('No eligible sound for this round.');
    const nextClip: RoomClip = {
      id: selection.id, audio: selection.audio, features: selection.features,
      durationSeconds: Math.min(8, selection.durationSeconds),
    };
    clipRef.current = nextClip;
    referenceRef.current = null;
    roundRef.current = next;
    await loadReference(nextClip);
    if (!referenceRef.current) return;
    send({ type: 'round:begin', round: next, rounds, mode, clip: nextClip });
    playCue('start');
  }
  function startTake() {
    if (!mic || roundRef.current === null || !clip || !myTurn) return;
    mic.start();
    playCue('record');
    setRecording(true);
    recordTimer.current = window.setTimeout(() => finishRef.current(), Math.min(8, clip.durationSeconds) * 1000);
  }
  async function finishTake() {
    if (!micRef.current || roundRef.current === null) return;
    window.clearTimeout(recordTimer.current);
    const samples = micRef.current.stop();
    setRecording(false);
    const resampled = resampleMono(samples, micRef.current.sampleRate, 22_050);
    const trimmed = trimSilence(resampled, 22_050, -43, 50).samples;
    const pcm = toPcm16(trimmed, 8, 22_050);
    if (host) {
      if (!referenceRef.current && clipRef.current) await loadReference(clipRef.current);
      if (!referenceRef.current || !playerId) return setError('Reference sound is still loading. Try this take again.');
      try {
        const result = scoreTake(pcm16ToFloat(pcm), 22_050, referenceRef.current);
        playCue(result.total >= 80 ? 'cheer' : result.total < 30 ? 'boo' : 'gavel');
        setScores((previous) => ({ ...previous, [playerId]: result }));
        if (send({ type: 'round:score', round: roundRef.current, playerId, score: result.total,
          judges: { rhythm: result.rhythm, melody: result.melody, energy: result.energy, vibe: result.vibe } }))
          setSubmitted(true);
        else setError('Connection lost before the score could send. Reconnect and retry.');
      } catch { setError('Could not score your take. Try the round again.'); }
      return;
    }
    if (send({ type: 'take:submit', round: roundRef.current, pcm16: encodePcm(pcm) }))
      setSubmitted(true);
    else setError('Connection lost before the take could send. Reconnect and retry.');
  }
  finishRef.current = () => { void finishTake(); };
  function leave() {
    send({ type: 'room:leave' });
    sessionStorage.removeItem(roomKey);
    setHasSavedRoom(false);
    location.href = '/';
  }
  const takeControls = <div className="room-take-controls">
    <div className="room-meter"><i style={{ width: `${Math.min(100, level * 100)}%` }}/></div>
    <button className="room-primary" disabled={!mic || !hostConnected || !myTurn || submitted || recording} onClick={startTake}>{submitted ? 'TAKE SENT ✓' : !myTurn ? 'WAIT FOR YOUR TURN' : mic ? 'START SINGING 🎙' : 'CONNECT YOUR MIC FIRST'}</button>
    {recording && <button className="room-secondary" onClick={() => void finishTake()}>FINISH TAKE ↗</button>}
    <p>{recording ? 'Recording… let the whole room hear you.' : submitted ? 'The judges are working. Watch the host screen.' : 'Your take is at most eight seconds.'}</p>
  </div>;

  return <main className="room-app">
    <header className="room-header"><a href="/" className="room-brand">VEEL <em>VEEL</em></a><span>LIVE VOICE PARTY · {host ? 'HOST SCREEN' : 'PHONE MIC'}</span></header>
    {error && <div role="alert" className="room-error">{error}</div>}
    {status !== 'connected' && <section className="room-entry">
      <span className="room-kicker">{host ? 'RUN THE SHOW' : 'STEP UP TO THE MIC'}</span>
      <h1>{host ? <>YOUR ROOM.<br/><em>YOUR RULES.</em></> : <>JOIN THE<br/><em>LINEUP.</em></>}</h1>
      <p>{host ? 'Create a room, sing from this screen, or invite friends on their phones.' : 'Enter the code from the host screen. Your phone becomes your microphone.'}</p>
      {host ? <button className="room-primary" disabled={status === 'connecting'} onClick={createRoom}>CREATE ROOM ↗</button> : <div className="room-form">
        <label>STAGE NAME<input maxLength={24} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>
        <label>ROOM CODE<input maxLength={4} value={inputCode} onChange={(event) => setInputCode(event.target.value.toUpperCase())} placeholder="ABCD" /></label>
        <button className="room-primary" disabled={status === 'connecting'} onClick={joinRoom}>JOIN ROOM ↗</button>
      </div>}
      {status === 'connecting' && <p role="status">Connecting to the room…</p>}
      {status === 'offline' && hasSavedRoom && <button className="room-secondary" onClick={reconnect}>RECONNECT TO ROOM ↗</button>}
    </section>}
    {status === 'connected' && <>
      <section className="room-code-bar"><div><span>ROOM CODE</span><strong>{code}</strong></div><div><span>{players.length} / 5 SINGERS</span><b>{phase.toUpperCase()}</b></div><button onClick={leave}>LEAVE</button></section>
      {host && <section className="room-invite">{inviteQr && <img src={inviteQr} width="142" height="142" alt={`Scan to join room ${code}`} />}<div><span>SCAN OR SHARE WITH PHONES</span><a href={joinUrl}>{joinUrl}</a><button onClick={() => void navigator.clipboard.writeText(joinUrl)}>COPY LINK ↗</button>{shareChoices.length > 1 && <label>NETWORK ADDRESS<select aria-label="Network address for invite link" value={shareOrigin} onChange={(event) => setShareOrigin(event.target.value)}>{shareChoices.map((choice) => <option key={choice.origin} value={choice.origin}>{choice.label}</option>)}</select></label>}</div></section>}
      {phase === 'lobby' && <section className="room-lobby">
        <div><span className="room-kicker">THE GREEN ROOM</span><h2>THE <em>LINEUP.</em></h2><div className="room-players">{players.map((player) => <div key={player.id} className="room-player"><i style={{ background: playerTokens[player.colorToken]!.color }} /> <b>{player.name}{player.hostPlayer ? ' · HOST' : ''}</b><small>{player.connected ? player.ready ? 'READY ✓' : 'GETTING READY' : 'OFFLINE'}</small></div>)}</div>{players.length === 0 && <p>Join as a singer here, or invite someone by phone.</p>}</div>
        {host ? <aside className="room-control">{!me ? <div className="room-host-seat"><label>YOUR STAGE NAME<input maxLength={24} value={name} onChange={(event) => setName(event.target.value)} placeholder="Host" /></label><button className="room-secondary" disabled={players.length >= 5} onClick={joinHostSinger}>JOIN AS SINGER 🎙</button></div> : <div className="room-host-seat"><small>YOU ARE IN THE LINEUP</small><div className="room-meter"><i style={{ width: `${Math.min(100, level * 100)}%` }}/></div><button className="room-secondary" disabled={Boolean(mic)} onClick={() => void openMic()}>{mic ? 'MIC CONNECTED ✓' : 'CONNECT MICROPHONE 🎙'}</button><button className="room-secondary" disabled={!mic} onClick={() => send({ type: 'room:ready', ready: !me.ready })}>{me.ready ? 'READY ✓ · TAP TO UNREADY' : 'I AM READY ↗'}</button></div>}<label>ROUNDS<select value={rounds} onChange={(event) => setRounds(Number(event.target.value) as 5 | 8 | 12)}><option value={5}>5 rounds</option><option value={8}>8 rounds</option><option value={12}>12 rounds</option></select></label><label>SINGING ORDER<select value={mode} onChange={(event) => setMode(event.target.value as 'together' | 'turns')}><option value="together">All at once</option><option value="turns">Take turns</option></select></label><small>{pack?.clips.length ?? '…'} sounds in this pack</small><button className="room-primary" disabled={!players.some((player) => player.ready) || !pack} onClick={() => void beginRound()}>START THE SHOW ↗</button>{!players.some((player) => player.ready) && <small>Join and ready up here, or wait for a phone singer.</small>}</aside> : <aside className="room-control"><div className="room-meter"><i style={{ width: `${Math.min(100, level * 100)}%` }}/></div><button className="room-secondary" disabled={Boolean(mic)} onClick={() => void openMic()}>{mic ? 'MIC CONNECTED ✓' : 'CONNECT MICROPHONE 🎙'}</button><button className="room-primary" disabled={!mic} onClick={() => send({ type: 'room:ready', ready: !me?.ready })}>{me?.ready ? 'READY ✓ · TAP TO UNREADY' : 'I AM READY ↗'}</button><p>Hold your phone close to your mouth and use headphones if the room is loud.</p></aside>}
      </section>}
      {host && phase !== 'lobby' && <section className="room-stage"><Suspense fallback={<div className="room-stage-loading">SETTING THE STAGE…</div>}><ArenaCanvas themeId="festival" score={Math.max(55, ...Object.values(scores).map((result) => result.total))} active={phase === 'perform' && stageLevel > 0.04} level={stageLevel} activeSinger={loudest?.colorToken ?? 0} /></Suspense></section>}
      {phase === 'perform' && <section className="room-round"><span className="room-kicker">ROUND {String((round ?? 0) + 1).padStart(2, '0')} / {rounds} · {mode === 'turns' ? 'TAKE TURNS' : 'ALL AT ONCE'}</span><h2>HEAR IT.<br/><em>BECOME IT.</em></h2><p>{host ? me ? 'Play the sound, then sing your version from this screen.' : mode === 'turns' ? `${activePlayer?.name ?? 'The singers'} is on the mic. Each ready singer gets a turn.` : 'Singers can replay the clip on their phones, then record their take.' : !hostConnected ? 'The host is reconnecting. Hold your take for a moment.' : mode === 'turns' && !myTurn ? `Wait for ${activePlayer?.name ?? 'the next singer'} to finish. Your turn is coming.` : 'Listen to the sound, then sing your version. Your take is scored on the host screen.'}</p><button className="room-secondary" disabled={!clip || recording} onClick={() => clip && void playClip(audioUrl(clip.audio)).catch(() => setError('Could not play the clip.'))}>▶ PLAY SOUND</button>{host ? <><div className="room-players">{players.map((player) => <div key={player.id} className="room-player"><i style={{ background: playerTokens[player.colorToken]!.color, transform: `scale(${1 + (liveLevels[player.id] ?? 0)})` }}/><b>{player.name}</b><small>{player.roundScore !== null ? `${player.roundScore} PTS` : !player.connected ? 'OFFLINE' : activePlayerId === player.id ? 'ON THE MIC 🎙' : 'WAITING FOR TAKE'}</small></div>)}</div>{me && takeControls}<button className="room-primary" disabled={!players.some((player) => player.roundScore !== null)} onClick={() => round !== null && send({ type: 'round:reveal', round })}>REVEAL SCORES ↗</button></> : takeControls}</section>}
      {phase === 'reveal' && <section className="room-round"><span className="room-kicker">JUDGES HAVE SPOKEN</span><h2>THE <em>SCORES.</em></h2><div className="room-players">{[...players].sort((a,b) => b.score - a.score).map((player, index) => <div key={player.id} className="room-player room-result"><strong>{index + 1}</strong><div className="room-result-body"><div><b>{player.name}</b><small>{player.score} PTS TOTAL · {player.roundScore ?? 0} THIS ROUND</small></div>{player.judges && <div className="room-judges">{Object.entries(player.judges).map(([judge, value]) => <span key={judge}>{judge.toUpperCase()} <b>{value}</b></span>)}</div>}</div></div>)}</div>{host && <button className="room-primary" onClick={() => void beginRound()}>{round !== null && round + 1 >= rounds ? 'FINAL RESULTS ↗' : 'NEXT SOUND ↗'}</button>}</section>}
      {phase === 'results' && <section className="room-round"><span className="room-kicker">THE FINAL PODIUM</span><h2>ABSOLUTE<br/><em>LEGENDS.</em></h2><div className="room-players">{[...players].sort((a,b) => b.score - a.score).map((player, index) => <div key={player.id} className="room-player"><strong>{['🏆','🥈','🥉'][index] ?? index + 1}</strong><b>{player.name}</b><small>{player.score} PTS</small></div>)}</div><button className="room-secondary" onClick={leave}>BACK TO HOME ↗</button></section>}
    </>}
  </main>;
}
