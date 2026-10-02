import { z } from 'zod';

export const ROOM_VERSION = 4;
export const roomCodeSchema = z.string().regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
const performanceMode = z.enum(['together', 'turns']);
const judgeScores = z.object({
  rhythm: z.number().int().min(0).max(100),
  melody: z.number().int().min(0).max(100),
  energy: z.number().int().min(0).max(100),
  vibe: z.number().int().min(0).max(100),
});
export const roomPlayerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(24),
  colorToken: z.number().int().min(0).max(4),
  ready: z.boolean(),
  connected: z.boolean(),
  hostPlayer: z.boolean(),
  score: z.number().int().min(0),
  roundScore: z.number().int().min(0).max(100).nullable(),
  judges: judgeScores.nullable(),
});
const token = z.string().min(24).max(128);
const roundNumber = z.number().int().min(0).max(11);
const clip = z.object({
  id: z.string().min(1).max(128),
  audio: z.string().min(1).max(256),
  features: z.string().min(1).max(256),
  durationSeconds: z.number().positive().max(8),
});

export const clientRoomMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('room:create') }),
  z.object({ type: z.literal('room:join'), code: roomCodeSchema, name: z.string().trim().min(1).max(24) }),
  z.object({ type: z.literal('room:host-player'), name: z.string().trim().min(1).max(24) }),
  z.object({ type: z.literal('room:rejoin'), code: roomCodeSchema, token }),
  z.object({ type: z.literal('room:ready'), ready: z.boolean() }),
  z.object({ type: z.literal('room:leave') }),
  z.object({ type: z.literal('round:begin'), round: roundNumber, rounds: z.union([z.literal(5), z.literal(8), z.literal(12)]), mode: performanceMode, clip }),
  z.object({ type: z.literal('round:reveal'), round: roundNumber }),
  z.object({ type: z.literal('round:finish') }),
  z.object({ type: z.literal('round:score'), round: roundNumber, playerId: z.string().uuid(), score: z.number().int().min(0).max(100), judges: judgeScores }),
  z.object({ type: z.literal('take:level'), round: roundNumber, level: z.number().min(0).max(1) }),
  // Eight seconds of mono 22.05 kHz PCM16 is 352,800 bytes before base64.
  z.object({ type: z.literal('take:submit'), round: roundNumber, pcm16: z.string().max(470_400) }),
]);
export type ClientRoomMessage = z.infer<typeof clientRoomMessageSchema>;

export const serverRoomMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('room:created'), version: z.literal(ROOM_VERSION), code: roomCodeSchema, token }),
  z.object({ type: z.literal('room:joined'), version: z.literal(ROOM_VERSION), code: roomCodeSchema, token, playerId: z.string().uuid() }),
  z.object({ type: z.literal('room:snapshot'), version: z.literal(ROOM_VERSION), code: roomCodeSchema, players: z.array(roomPlayerSchema).max(5), hostConnected: z.boolean(), round: roundNumber.nullable(), rounds: z.union([z.literal(5), z.literal(8), z.literal(12)]), mode: performanceMode, activePlayerId: z.string().uuid().nullable(), clip: clip.nullable(), phase: z.enum(['lobby', 'listen', 'perform', 'reveal', 'results']) }),
  z.object({ type: z.literal('room:error'), message: z.string().max(200) }),
  z.object({ type: z.literal('room:closed') }),
  z.object({ type: z.literal('round:begin'), round: roundNumber, rounds: z.union([z.literal(5), z.literal(8), z.literal(12)]), mode: performanceMode, clip }),
  z.object({ type: z.literal('round:reveal'), round: roundNumber }),
  z.object({ type: z.literal('round:finish') }),
  z.object({ type: z.literal('round:score'), round: roundNumber, playerId: z.string().uuid(), score: z.number().int().min(0).max(100), judges: judgeScores }),
  z.object({ type: z.literal('take:level'), round: roundNumber, playerId: z.string().uuid(), level: z.number().min(0).max(1) }),
  z.object({ type: z.literal('take:submit'), round: roundNumber, playerId: z.string().uuid(), pcm16: z.string().max(470_400) }),
]);
export type ServerRoomMessage = z.infer<typeof serverRoomMessageSchema>;
