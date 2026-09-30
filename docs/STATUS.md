# M0–M2 status

## Working now

- The pack indexer turns 534 existing source clips into normalized 22.05 kHz mono WAV, feature JSON, difficulty levels and `pack.json`. Source media and the Python harvester remain untouched.
- A checkout without local source media generates twelve synthesized demo sounds so `pnpm dev` still opens a playable local game.
- The browser app has local HTTPS development, a QR LAN address, microphone setup, the two procedural stage themes, the arena sandbox, local Mic Drop, 5/8/12 round selection, bots, six starter Chaos Cards, a once-per-game Golden Buzzer, local roast playback and a final podium.
- Audio capture uses an AudioWorklet and on-device DSP. Chromium with a fake microphone completes five rounds and scores the matching first clip at least 90. Real clip and synthetic DSP tests pass.
- `docs/screens/` contains Home, Mic Setup, Lobby, both theme previews, HUD, judge reveal and podium screenshots. Browser screenshots use `?e2e=1` to avoid a headless software WebGL stall.

## Known limits

- The arena includes procedural stage, five performers, judges, lights and an instanced crowd. The full character customizer, camera choreography, crowd shader, post-processing and reactions in the source brief remain unbuilt.
- The local game has one human singer and four scored bots. Bot playback is a transformed reference clip, and the modes after Mic Drop remain unavailable.
- Chaos Cards in this milestone cover the first six by name and local scoring/playback behavior. Whisper and Tomato scoring are simplified; the full data-driven transform interface remains for later work.
- The app has no IndexedDB feature cache, scheduled Web Audio SFX suite, highlight reel or share-card export yet.
- The normal Three.js renderer has not been measured on an integrated GPU; FPS and draw-call targets remain unverified.
- Room relay and controller behavior are M3 scope. The current `apps/server` and `packages/protocol` are scaffolds.

## Suggested M3 prompt

> Continue Veel Veel from docs/SPEC.md and docs/STATUS.md. First close the remaining M0–M2 gaps listed in STATUS.md, including real-device microphone QA and arena performance measurement. Then implement M3 Room mode with the host-authoritative room relay, phone controllers, typed/versioned messages, rejoin tokens, same-room PCM/feature transfer and LocalTransport/WebSocketTransport, plus Last Voice Standing. Keep the Python pipeline and ignored packs untouched. Run the full checks, capture room screenshots, and report measured limits and remaining risks.
