import { z } from 'zod';

export const playerSchema = z.object({
  id: z.string().min(1).max(48),
  name: z.string().min(1).max(24),
  colorToken: z.number().int().min(0).max(4),
});
export const roomMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('room:create'), player: playerSchema }),
  z.object({ type: z.literal('room:join'), code: z.string().length(5), player: playerSchema }),
  z.object({ type: z.literal('room:ready'), ready: z.boolean() }),
  z.object({ type: z.literal('room:leave') }),
  z.object({
    type: z.literal('round:phase'),
    phase: z.enum(['listen', 'perform', 'reveal']),
    round: z.number().int().min(0).max(11),
  }),
  z.object({
    type: z.literal('round:score'),
    playerId: z.string().min(1),
    score: z.number().int().min(0).max(100),
  }),
]);
export type RoomMessage = z.infer<typeof roomMessageSchema>;
// Local room transport and state synchronization are intentionally deferred to M3.
