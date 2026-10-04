# Room protocol v5

`/room` accepts Zod-validated JSON over same-origin WSS in production. Development uses WSS on port 8787. Identity responses and snapshots advertise version 5. Four-letter codes, random 192-bit rejoin tokens and up to five singer seats remain unchanged. A screen-only host does not occupy a seat; a singing host does. At least two connected, ready singers are required to start each round.

## Automatic party round

1. Host sends `round:begin` with a clip, round number and 5/8/12-round set length. Public clip paths are restricted to pack WAV/features paths.
2. Every browser downloads and decodes the reference before `round:loaded`. The relay waits for the host and all connected ready singers.
3. Relay broadcasts `round:go` with a 1500 ms lead. Clients schedule reference playback, a three-second preparation interval, and automatic simultaneous recording. The lead compensates for ordinary delivery jitter, but this is not sample-accurate cross-device synchronization.
4. Every singer, including the host, submits up to eight seconds of mono 22.05 kHz PCM16. Phone takes are scored by the host; the host scores its own take locally. The relay retains takes in room memory for playback. Local mode does not upload PCM.
5. `round:score` is accepted only from the host for an eligible take, once per player per round. Scores and cumulative totals are masked in snapshots until that singer's playback finishes.
6. Once all connected ready singers have submitted scored takes, the relay broadcasts one `take:replay` at a time. It waits for the take's actual PCM duration, reveals that score, pauses for the audience reaction, then advances. A bounded timeout skips missing takes so a stalled microphone cannot hold the room indefinitely.
7. `round:reveal` opens standings and the next-round button. After the last reveal, `round:finish` opens results.

The public UI uses simultaneous singing. Legacy `turns` remains in the wire schema for compatibility with earlier callers, but its old manual controls are no longer exposed or supported by the new automatic party UI.

## Party voice chat

Voice chat is opt-in: Off, Always on, or Push to talk. PCM16 at 16 kHz is relayed in roughly 160 ms chunks to the other room members. It uses the same authenticated WebSocket, avoiding a separate TURN service for the first public playtest. Both client and relay mute chat while listening/recording and reopen it for take playback and results. Push to talk supports pointer capture, keyboard release, blur and cancellation. Headphones are recommended because scoring capture deliberately avoids speech-processing distortion.

Voice chat is transient; round takes remain in memory until the next round or room expiry. There are no audio files, analytics or accounts. Rooms expire after 30 minutes of inactivity, and restarting the single relay ends all rooms. Payloads are capped at 600 KiB, messages at 50/second/socket, voice chunks at 12,000 base64 characters, room count at 100 and singer count at five. Voice relay bandwidth grows with room membership; WebRTC is a future scaling option.

Reconnect tokens restore seats and revealed scores, but do not replay missed audio or restart an interrupted take. Reconnect the microphone and join the next round. Host reload during unscored submissions is not guaranteed to recover the current round; the timeout permits progress.
