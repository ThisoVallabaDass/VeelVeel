import { randomBytes, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { clientRoomMessageSchema, ROOM_VERSION } from '@veel-veel/protocol';
import type { ClientRoomMessage, ServerRoomMessage } from '@veel-veel/protocol';

type Player = {
  id: string;
  name: string;
  token: string;
  socket: WebSocket | null;
  ready: boolean;
  score: number;
  roundScore: number | null;
  judges: Extract<ClientRoomMessage, { type: 'round:score' }>['judges'] | null;
  submittedRound: number | null;
  scoredRound: number | null;
  lastLevelAt: number;
};
type Room = {
  code: string;
  hostToken: string;
  host: WebSocket | null;
  players: Player[];
  round: number | null;
  rounds: 5 | 8 | 12;
  mode: 'together' | 'turns';
  activePlayerId: string | null;
  clip: Extract<ClientRoomMessage, { type: 'round:begin' }>['clip'] | null;
  phase: 'lobby' | 'listen' | 'perform' | 'reveal' | 'results';
  touchedAt: number;
};
type Connection = { room: Room; player?: Player; host: boolean };
const rooms = new Map<string, Room>();
const connections = new WeakMap<WebSocket, Connection>();
const roomAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const port = Number(process.env.PORT ?? 8787);
const certPath = resolve(fileURLToPath(new URL('../../../.cache/dev-cert/_cert.pem', import.meta.url)));
const staticRoot = resolve(fileURLToPath(new URL('../../veel-veel/dist/', import.meta.url)));
const packRoot = resolve(fileURLToPath(new URL('../../../packs/', import.meta.url)));
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.wav': 'audio/wav', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png',
};
const token = () => randomBytes(24).toString('base64url');
function roomCode() {
  let code = '';
  do {
    code = Array.from(randomBytes(4), (byte) => roomAlphabet[byte % roomAlphabet.length]!).join('');
  } while (rooms.has(code));
  return code;
}
function send(socket: WebSocket | null, message: ServerRoomMessage) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}
function broadcast(room: Room, message: ServerRoomMessage) {
  send(room.host, message);
  for (const player of room.players) send(player.socket, message);
}
function snapshot(room: Room) {
  broadcast(room, {
    type: 'room:snapshot', version: ROOM_VERSION, code: room.code,
    hostConnected: room.host !== null, round: room.round, rounds: room.rounds,
    mode: room.mode, activePlayerId: room.activePlayerId, clip: room.clip, phase: room.phase,
    players: room.players.map((player, index) => ({
      id: player.id, name: player.name, colorToken: index, ready: player.ready,
      connected: player.socket !== null, score: player.score,
      roundScore: player.roundScore,
      judges: player.judges,
    })),
  });
}
function fail(socket: WebSocket, message: string) {
  send(socket, { type: 'room:error', message });
}
function closeRoom(room: Room) {
  broadcast(room, { type: 'room:closed' });
  rooms.delete(room.code);
  room.host?.close(1000, 'Room closed');
  for (const player of room.players) player.socket?.close(1000, 'Room closed');
}
function detach(socket: WebSocket) {
  const connection = connections.get(socket);
  if (!connection) return;
  connections.delete(socket);
  const { room, player, host } = connection;
  if (host && room.host === socket) room.host = null;
  if (player && player.socket === socket) {
    player.socket = null;
    if (room.phase === 'lobby') player.ready = false;
    if (room.activePlayerId === player.id) advanceTurn(room);
  }
  room.touchedAt = Date.now();
  snapshot(room);
}
function advanceTurn(room: Room) {
  room.activePlayerId = room.mode === 'turns'
    ? room.players.find((item) => item.ready && item.socket && item.roundScore === null)?.id ?? null
    : null;
}
function attach(socket: WebSocket, room: Room, host: boolean, player?: Player) {
  if (host) {
    if (room.host && room.host !== socket) room.host.close(4000, 'Rejoined elsewhere');
    room.host = socket;
  } else if (player) {
    if (player.socket && player.socket !== socket) player.socket.close(4000, 'Rejoined elsewhere');
    player.socket = socket;
  }
  connections.set(socket, player ? { room, host, player } : { room, host });
  room.touchedAt = Date.now();
}
function handle(socket: WebSocket, message: ClientRoomMessage) {
  const connection = connections.get(socket);
  if (message.type === 'room:create') {
    if (connection) return fail(socket, 'Already in a room.');
    if (rooms.size >= 100) return fail(socket, 'Room server is full. Try later.');
    const room: Room = {
      code: roomCode(), hostToken: token(), host: null, players: [], round: null, rounds: 5, clip: null,
      mode: 'together', activePlayerId: null, phase: 'lobby', touchedAt: Date.now(),
    };
    rooms.set(room.code, room);
    attach(socket, room, true);
    send(socket, { type: 'room:created', version: ROOM_VERSION, code: room.code, token: room.hostToken });
    snapshot(room);
    return;
  }
  if (message.type === 'room:join') {
    if (connection) return fail(socket, 'Already in a room.');
    const room = rooms.get(message.code);
    if (!room) return fail(socket, 'Room code not found.');
    if (room.players.length >= 5) return fail(socket, 'This room has five singers already.');
    if (room.phase !== 'lobby') return fail(socket, 'The show has started. Join the next room.');
    const player: Player = {
      id: randomUUID(), name: message.name.trim(), token: token(), socket: null,
      ready: false, score: 0, roundScore: null, judges: null, submittedRound: null, scoredRound: null, lastLevelAt: 0,
    };
    room.players.push(player);
    attach(socket, room, false, player);
    send(socket, { type: 'room:joined', version: ROOM_VERSION, code: room.code, token: player.token, playerId: player.id });
    snapshot(room);
    return;
  }
  if (message.type === 'room:rejoin') {
    if (connection) return fail(socket, 'Already in a room.');
    const room = rooms.get(message.code);
    if (!room) return fail(socket, 'Room expired or closed.');
    if (room.hostToken === message.token) {
      attach(socket, room, true);
      send(socket, { type: 'room:created', version: ROOM_VERSION, code: room.code, token: room.hostToken });
    } else {
      const player = room.players.find((item) => item.token === message.token);
      if (!player) return fail(socket, 'Rejoin token is invalid.');
      attach(socket, room, false, player);
      send(socket, { type: 'room:joined', version: ROOM_VERSION, code: room.code, token: player.token, playerId: player.id });
    }
    snapshot(room);
    return;
  }
  if (!connection) return fail(socket, 'Create or join a room first.');
  const { room, player, host } = connection;
  room.touchedAt = Date.now();
  if (message.type === 'room:leave') {
    if (host) closeRoom(room);
    else if (player) {
      room.players = room.players.filter((item) => item !== player);
      connections.delete(socket);
      socket.close(1000, 'Left room');
      if (room.activePlayerId === player.id) advanceTurn(room);
      snapshot(room);
    }
    return;
  }
  if (message.type === 'room:ready') {
    if (!player || room.phase !== 'lobby') return fail(socket, 'Ready is available in the lobby.');
    player.ready = message.ready;
    snapshot(room);
    return;
  }
  if (message.type === 'round:begin') {
    if (!host) return fail(socket, 'Only the host can start a round.');
    if ((room.round === null && room.phase !== 'lobby') || (room.round !== null && room.phase !== 'reveal')) return fail(socket, 'Reveal the current round first.');
    if (!room.players.some((item) => item.socket !== null && item.ready)) return fail(socket, 'Wait for a ready singer.');
    if (room.round !== null && message.round !== room.round + 1) return fail(socket, 'Round number is out of order.');
    if (room.round === null && message.round !== 0) return fail(socket, 'Start at round one.');
    room.round = message.round;
    room.rounds = message.rounds;
    room.mode = message.mode;
    room.clip = message.clip;
    room.phase = 'perform';
    for (const item of room.players) {
      item.submittedRound = null;
      item.roundScore = null;
      item.judges = null;
    }
    advanceTurn(room);
    broadcast(room, message);
    snapshot(room);
    return;
  }
  if (message.type === 'take:level') {
    if (!player || room.phase !== 'perform' || room.round !== message.round) return;
    if (room.mode === 'turns' && room.activePlayerId !== player.id) return;
    if (Date.now() - player.lastLevelAt < 60) return;
    player.lastLevelAt = Date.now();
    send(room.host, { ...message, playerId: player.id });
    return;
  }
  if (message.type === 'take:submit') {
    if (!player || room.phase !== 'perform' || room.round !== message.round) return fail(socket, 'No active round for this take.');
    if (!player.ready) return fail(socket, 'Only ready singers can submit a take.');
    if (!room.host) return fail(socket, 'The host is disconnected. Wait for them to return.');
    if (room.mode === 'turns' && room.activePlayerId !== player.id) return fail(socket, 'Wait for your turn.');
    if (player.submittedRound === message.round) return fail(socket, 'Your take was already sent.');
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(message.pcm16)) return fail(socket, 'Invalid audio data.');
    player.submittedRound = message.round;
    send(room.host, { ...message, playerId: player.id });
    return;
  }
  if (message.type === 'round:score') {
    if (!host || room.round !== message.round) return fail(socket, 'Only the host scores the active round.');
    const target = room.players.find((item) => item.id === message.playerId);
    if (!target) return fail(socket, 'Singer not found.');
    if (target.submittedRound !== message.round || target.scoredRound === message.round) return fail(socket, 'Take missing or already scored.');
    target.scoredRound = message.round;
    target.score += message.score;
    target.roundScore = message.score;
    target.judges = message.judges;
    if (room.mode === 'turns') advanceTurn(room);
    broadcast(room, message);
    snapshot(room);
    return;
  }
  if (message.type === 'round:reveal') {
    if (!host || room.round !== message.round || room.phase !== 'perform') return fail(socket, 'Only the host reveals the active round.');
    if (!room.players.some((item) => item.roundScore !== null)) return fail(socket, 'Wait for a scored take.');
    room.phase = 'reveal';
    broadcast(room, message);
    snapshot(room);
    return;
  }
  if (message.type === 'round:finish') {
    if (!host || room.phase !== 'reveal' || room.round === null || room.round + 1 < room.rounds) return fail(socket, 'Finish after the final reveal.');
    room.phase = 'results';
    broadcast(room, message);
    snapshot(room);
  }
}

async function serve(request: IncomingMessage, response: ServerResponse) {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ service: 'veel-veel', rooms: rooms.size }));
    return;
  }
  // The same process can serve a production client build and generated pack behind HTTPS.
  const packPath = pathname.startsWith('/tamil-meme/') ? pathname.slice(1) : null;
  const root = packPath ? packRoot : staticRoot;
  const relative = packPath ?? (pathname === '/' || !extname(pathname) ? 'index.html' : pathname.slice(1));
  const file = resolve(root, relative);
  if (!file.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'content-type': mime[extname(file)] ?? 'application/octet-stream',
      'content-length': info.size,
      'cache-control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
}
let certificate: string | null = null;
if (process.env.NODE_ENV !== 'production') {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { certificate = await readFile(certPath, 'utf8'); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 150)); }
  }
  if (!certificate) throw new Error(`Dev certificate missing: ${certPath}. Start with pnpm dev.`);
}
const server = certificate
  ? createHttpsServer({ cert: certificate, key: certificate }, serve)
  : createHttpServer(serve);
const socketServer = new WebSocketServer({ noServer: true, maxPayload: 600 * 1024 });
server.on('upgrade', (request, stream, head) => {
  if (new URL(request.url ?? '/', 'http://localhost').pathname !== '/room') {
    stream.destroy();
    return;
  }
  const origin = request.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).hostname !== new URL(`http://${request.headers.host}`).hostname) {
        stream.destroy();
        return;
      }
    } catch { stream.destroy(); return; }
  }
  socketServer.handleUpgrade(request, stream, head, (socket) => {
    let messageWindow = Date.now();
    let messageCount = 0;
    socket.on('message', (raw, isBinary) => {
      const now = Date.now();
      if (now - messageWindow >= 1000) { messageWindow = now; messageCount = 0; }
      if (++messageCount > 50) { socket.close(1008, 'Rate limit'); return; }
      if (isBinary) return fail(socket, 'Only versioned JSON messages are accepted.');
      let parsed: unknown;
      try { parsed = JSON.parse(raw.toString()); } catch { return fail(socket, 'Invalid JSON.'); }
      const result = clientRoomMessageSchema.safeParse(parsed);
      if (!result.success) return fail(socket, 'Invalid room message.');
      handle(socket, result.data);
    });
    socket.on('close', () => detach(socket));
  });
});
setInterval(() => {
  const expiry = Date.now() - 30 * 60_000;
  for (const room of rooms.values()) if (room.touchedAt < expiry) closeRoom(room);
}, 60_000).unref();
server.listen(port, '0.0.0.0', () => console.log(`Veel Veel room server listening on ${port}`));
