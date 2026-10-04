# Veel Veel build status

Updated 4 October 2026.

## Playable now

- Local Mic Drop with one human and four bots, 5/8/12 rounds, microphone setup, DSP scoring, Golden Buzzer, starter Chaos Cards, roast playback and podium.
- Online room Mic Drop for 2–5 ready singers, with an optional singing host. Host/Join controls are large and at the top. Share the room URL or QR code.
- Automatic reference loading, shared listening, three-second preparation, and simultaneous microphone recording. Each take is played to every room member in sequence; the score follows that take. Final standings and next-round controls are shared. Missing submissions have a bounded timeout.
- Opt-in voice chat with Always on and Push to talk. Listening/recording mutes voice chat at both client and server; it returns for take playback. Keyboard and pointer release are handled.
- The stage appears on host and player screens. Articulated singers walk/sway/sing, replay mouths follow playback amplitude, cheering crowds stand and wave, high scores trigger confetti, and low scores trigger flying tomatoes. Reduced-motion preferences are respected.
- 590 indexed clips in this workspace; 452 meet default duration/flag eligibility. The existing 534 Tamil clips are preserved. 56 new labelled vocal excerpts were imported (55 eligible; the silent “You are my sunshine” excerpt is excluded): 45 entries in the English meme category and 11 Tamil entries. The English meme category includes some internationally circulated, non-English vocals. The room default selects from curated vocals, with English/Tamil filters and no repeats within a setlist.
- Sources include the owner's two playlists, sixteen vocal cuts from the timestamped compilation, the requested Tamil short/template, and a related “What the dog doin?” clip found through search. Mechanical/startup/glass/pipe effects were excluded. Metadata, source URLs and cut times live in `scripts/sound-sources.json`; `python scripts/import-sounds.py` reproduces the ignored media.
- The Node production server serves both game assets and rooms over one HTTPS origin through a temporary Cloudflare tunnel. Current link: https://network-european-mixing-restoration.trycloudflare.com . This is a running playtest, dependent on this computer remaining awake/online. Permanent hosting has not been provisioned.

## Verification

- Eighteen Vitest checks pass, including real-pack DSP and relay tests for minimum players, voice gating, score masking, and replay-before-score ordering.
- TypeScript and ESLint pass. The production build passes. Arena code remains lazy-loaded (about 134 kB gzip); the main bootstrap is about 130 kB gzip.
- Two-player and five-player Chromium room tests passed through the public HTTPS endpoint, including automatic singing, host participation, full-room rejection, revealed judge scores and reconnect identity. All four browser tests passed through the public endpoint, including a complete five-round local game.
- A real Three.js page was rendered and captured at `docs/screens/15-public-home-3d.png` without page errors. This headless software-rendering run measured about 15 FPS; it is not an integrated-GPU or mobile performance result. Hardware FPS/draw-call targets remain unverified.

## Remaining boundaries

- Permanent cloud hosting needs the owner's hosting account/repository connection; `render.yaml`, `Dockerfile` and `docs/DEPLOY.md` prepare that path. The current temporary link changes when its tunnel restarts.
- Source provenance is retained, but YouTube redistribution rights are not verified. Use cleared media for permanent public release. Media is gitignored. Local builds can generate demos; production Docker builds now require a verified sound bundle URL and cannot silently fall back. The 590-clip bundle is published as GitHub release soundpack-v1; its URL and SHA-256 are configured in render.yaml. The code is pushed to ThisoVallabaDass/VeelVeel.
- The requested “Azhuga onnum venam okay” short is included as a labelled opening excerpt. Exact phrase boundaries still need a Tamil speaker's audition; automatic captions did not provide a reliable alignment.
- Synchronization uses buffered playback and a shared lead interval, not clock-synchronized sample scheduling. Physical iOS/Android microphone, speaker feedback and geographically separated voice-chat testing remain manual checks. Headphones are recommended.
- Voice relay uses PCM over WebSocket and is intended for small parties. No TURN service is needed, but bandwidth scales with participants. Browser background throttling or connection loss can miss a round; reconnect for the next one. Rooms and takes are in memory, so server restart ends rooms.
- Full avatar customization, imported rigged models, cinematic cameras, advanced post-processing and remaining game modes (Last Voice Standing, Sound Whispers, Asal/Nakal, Voice Charades, Daily Stage and Remix Riot) are not complete. Daily Stage is visibly disabled. This release scope is playable Mic Drop, not every mode in the original brief.

- Sound bundle export/restore is implemented with streamed compression, whole-archive and per-file checksums, path restrictions and completeness checks. See `docs/sound-bundle-release.json` and `docs/DEPLOY.md`.
