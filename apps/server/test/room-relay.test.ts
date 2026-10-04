import { afterAll, beforeAll, expect, test } from 'vitest';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import type { ClientRoomMessage, ServerRoomMessage } from '../../../packages/protocol/src/index.js';

const port = 18791;
const service = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: String(port) }, stdio: 'pipe',
});
const sockets: WebSocket[] = [];
type Peer = { socket: WebSocket; messages: ServerRoomMessage[]; send: (m: ClientRoomMessage) => void };
async function peer(): Promise<Peer> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/room`);
  sockets.push(socket);
  const messages: ServerRoomMessage[] = [];
  socket.on('message', (raw) => messages.push(JSON.parse(raw.toString()) as ServerRoomMessage));
  await new Promise<void>((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  return { socket, messages, send: (m) => socket.send(JSON.stringify(m)) };
}
async function waitFor<T extends ServerRoomMessage['type']>(p: Peer, type: T) {
  await expect.poll(() => p.messages.some((m) => m.type === type), { timeout: 10000 }).toBe(true);
  return p.messages.find((m) => m.type === type) as Extract<ServerRoomMessage, { type: T }>;
}
beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    service.stdout.on('data', () => resolve());
    service.once('error', reject);
    service.once('exit', (code) => reject(new Error(`Server exited ${code}`)));
  });
});
afterAll(() => { sockets.forEach((s) => s.close()); service.kill(); });

test('relay enforces minimum, masks scores, orders replays and gates party voice', async () => {
  const host = await peer(); host.send({ type: 'room:create' });
  const { code } = await waitFor(host, 'room:created');
  const one = await peer(); one.send({ type: 'room:join', code, name: 'One' });
  const idOne = (await waitFor(one, 'room:joined')).playerId;
  one.send({ type: 'room:ready', ready: true });
  const begin: ClientRoomMessage = { type: 'round:begin', round: 0, rounds: 5, mode: 'together', clip: { id: 'test', audio: 'clips/test.wav', features: 'features/test.json', durationSeconds: 0.1 } };
  host.send(begin);
  expect((await waitFor(host, 'room:error')).message).toContain('two');
  const two = await peer(); two.send({ type: 'room:join', code, name: 'Two' });
  const idTwo = (await waitFor(two, 'room:joined')).playerId;
  two.send({ type: 'room:ready', ready: true });
  await expect.poll(() => host.messages.filter((m) => m.type === 'room:snapshot').at(-1)?.players.filter((p) => p.ready).length).toBe(2);
  one.send({ type: 'voice:audio', pcm16: 'AAAAAA==' });
  await waitFor(two, 'voice:audio');
  host.send(begin); await waitFor(two, 'round:begin');
  const voiceBefore = two.messages.filter((m) => m.type === 'voice:audio').length;
  one.send({ type: 'voice:audio', pcm16: 'AAAAAA==' });
  for (const p of [host, one, two]) p.send({ type: 'round:loaded', round: 0 });
  await waitFor(one, 'round:go');
  expect(two.messages.filter((m) => m.type === 'voice:audio')).toHaveLength(voiceBefore);
  one.send({ type: 'take:submit', round: 0, pcm16: 'AAAAAA==' });
  await waitFor(host, 'take:submit');
  const judges = { rhythm: 90, melody: 90, energy: 90, vibe: 90 };
  host.send({ type: 'round:score', round: 0, playerId: idOne, score: 90, judges });
  host.send({ type: 'round:reveal', round: 0 });
  await expect.poll(() => host.messages.filter((m) => m.type === 'room:error').length).toBe(2);
  expect(one.messages.some((m) => m.type === 'round:score')).toBe(false);
  two.send({ type: 'take:submit', round: 0, pcm16: 'AAAAAA==' });
  await expect.poll(() => host.messages.filter((m) => m.type === 'take:submit').length).toBe(2);
  host.send({ type: 'round:score', round: 0, playerId: idTwo, score: 30, judges });
  await waitFor(one, 'round:reveal');
  expect(one.messages.filter((m) => ['take:replay', 'round:score', 'round:reveal'].includes(m.type)).map((m) => m.type)).toEqual(['take:replay', 'round:score', 'take:replay', 'round:score', 'round:reveal']);
  const final = one.messages.filter((m) => m.type === 'room:snapshot').at(-1)!;
  expect(final.players.map((p) => p.score)).toEqual([90, 30]);
});


