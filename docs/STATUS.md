# Veel Veel build status

Updated 9 October 2026.

## Playable now

- Local Mic Drop with one human and four bots, 5/7/10/15 rounds, microphone setup, DSP scoring, Golden Buzzer, starter Chaos Cards, roast playback and podium.
- Online room Mic Drop for 2–5 ready singers. The host joins as a singer by default, with an audience-only hosting option. Up to 20 audience members can watch and listen without taking singer seats or microphone permission. Audience members can join after a set starts and reconnect with their room token. Share the room URL or QR code.
- Automatic reference loading, shared listening, three-second preparation, and simultaneous microphone recording. Each take is played to every room member in sequence; the score follows that take. A shared 6.5-second intermission automatically starts the next round and opens the final podium after the chosen 5, 7, 10 or 15 rounds. The host can skip the intermission. Missing submissions have a bounded timeout.
- Opt-in voice chat with Always on and Push to talk for hosts, singers and audience. Incoming chat can be muted separately from outgoing voice. Listening/recording pauses voice chat at both client and server; it returns for take playback. Keyboard, pointer, focus and page-visibility release are handled.
- The home screen shows Stage and Theatre as two direct venue choices. The host can change the room venue; all participants receive the choice. The join flow and lobby fit a touch-sized phone viewport. Where supported, the screen wake lock keeps the round visible.
- The stage appears on host and player screens. Articulated singers walk/sway/sing, replay mouths follow playback amplitude, cheering crowds stand and wave, high scores trigger confetti, and low scores trigger flying tomatoes. Reduced-motion preferences are respected.
- 590 indexed clips in this workspace; 452 meet default duration/flag eligibility. The existing 534 Tamil clips are preserved. 56 new labelled vocal excerpts were imported (55 eligible; the silent “You are my sunshine” excerpt is excluded): 45 entries in the English meme category and 11 Tamil entries. The English meme category includes some internationally circulated, non-English vocals. The room default selects from curated vocals, with English/Tamil filters and no repeats within a setlist.
- Sources include the owner's two playlists, sixteen vocal cuts from the timestamped compilation, the requested Tamil short/template, and a related “What the dog doin?” clip found through search. Mechanical/startup/glass/pipe effects were excluded. Metadata, source URLs and cut times live in `scripts/sound-sources.json`; `python scripts/import-sounds.py` reproduces the ignored media.
- The live game is hosted at https://veel-veel.onrender.com on a free Render Docker service, with the complete sound bundle and WebSocket rooms on the same HTTPS origin. It does not depend on the owner's computer.
- Recording has a separate studio with explicit listen/countdown/record/submitted states, microphone activity history, a sound-detection message and an amplitude-driven character. Replays show original/take loudness contours and judge breakdowns. The microphone logo is bundled with the application.
- Room mic setup measures a quiet baseline for 900 ms. A take needs at least 120 ms and 8% activity above an absolute/calibrated threshold before trimming. Room DSP runs in workers to avoid blocking capture timers and animations. This is an activity gate, not speech recognition: nearby voices can still be picked up.

- The stage now has five evenly spaced singer slots with visible grille microphones, a raised platform behind 120 foreground fans, standing/clapping poses above 80 points, and tomatoes below 40. Reaction buttons in the sandbox drive the actual stage score. Reduced motion keeps reaction poses without continuous movement.
- Captured takes pass through a 40 Hz rumble filter, high-frequency rolloff and calibrated soft noise gate with a 200 ms hold. Browser speech suppression remains off to preserve meme vocal tone. Scoring down-weights unreliable pitch and penalizes very short imitations more strongly. This cannot isolate one speaker from other nearby speech.

## Verification

- Twenty-six Vitest checks pass, including real-pack DSP, silence/hiss/DC/click rejection, calibrated hum rejection, and relay tests for minimum players, voice gating, score masking, and replay-before-score ordering.
- TypeScript and ESLint pass. The production build passes. Arena code remains lazy-loaded (about 134 kB gzip); the main bootstrap is about 130 kB gzip.
- Two-player and five-player Chromium room tests passed through the public HTTPS endpoint, including automatic singing, host participation, full-room rejection, revealed judge scores and reconnect identity. All four browser tests passed through the public endpoint, including a complete five-round local game.
- The October 5 studio update passed the full local-game browser test and all four room tests against a local production build. The added test feeds background hum through real browser microphone capture and verifies zero points for both singers. Mobile recording screenshots use a 390-pixel viewport; physical-phone testing is still manual.
- A real Three.js page was rendered and captured at `docs/screens/15-public-home-3d.png` without page errors. This headless software-rendering run measured about 15 FPS; it is not an integrated-GPU or mobile performance result. Hardware FPS/draw-call targets remain unverified.

## Remaining boundaries

- Render free-tier cold starts and in-memory rooms remain availability limits. The live deployment uses one instance; restarts clear rooms.
- Source provenance is retained, but YouTube redistribution rights are not verified. Use cleared media for permanent public release. Media is gitignored. Local builds can generate demos; production Docker builds now require a verified sound bundle URL and cannot silently fall back. The 590-clip bundle is published as GitHub release soundpack-v1; its URL and SHA-256 are configured in render.yaml. The code is pushed to ThisoVallabaDass/VeelVeel.
- The requested “Azhuga onnum venam okay” short is included as a labelled opening excerpt. Exact phrase boundaries still need a Tamil speaker's audition; automatic captions did not provide a reliable alignment.
- Synchronization uses buffered playback and a shared lead interval, not clock-synchronized sample scheduling. Physical iOS/Android microphone, speaker feedback and geographically separated voice-chat testing remain manual checks. Headphones are recommended.
- Voice relay uses PCM over WebSocket and is intended for small parties. No TURN service is needed, but bandwidth scales with participants. Browser background throttling or connection loss can miss a round; reconnect for the next one. Rooms and takes are in memory, so server restart ends rooms.
- Full avatar customization, imported rigged models, cinematic cameras, advanced post-processing and remaining game modes (Last Voice Standing, Sound Whispers, Asal/Nakal, Voice Charades, Daily Stage and Remix Riot) are not complete. Daily Stage is omitted from the home action row until implemented. This release scope is playable Mic Drop, not every mode in the original brief.

- Sound bundle export/restore is implemented with streamed compression, whole-archive and per-file checksums, path restrictions and completeness checks. See `docs/sound-bundle-release.json` and `docs/DEPLOY.md`.
