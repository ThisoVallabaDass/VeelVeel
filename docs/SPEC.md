# VEEL VEEL — MASTER BUILD PROMPT

## Role & mission
You are the lead game engineer, technical artist and game designer on "Veel Veel": a browser-based voice-mimic party game for up to 5 players. A short sound clip plays, players imitate it with their voices, and the game scores how closely each "voice shape" matches. It is inspired by Mimic Party but has its own arena, modes and chaos. Sound pack #1 is Tamil meme clips, already downloaded by our data pipeline. Build something that feels like a polished, hilarious, endlessly replayable party game, not a tech demo.

## This run
- Do Milestones M0, M1 and M2 (listed at the bottom), then STOP and report. Do not start M3+ until I say "continue".
- Work autonomously. Don't ask me questions: pick the best option, log it in docs/DECISIONS.md (decision + one-line why), and keep going.
- Never fake results. If something can't run in your sandbox (installs, browsers, mic), say so and give me the exact command to run locally.

## Step 0 — discover before coding
1. Inspect the workspace and find the sound pack the pipeline produced (folders of .wav/.mp3/.m4a/.ogg clips plus any manifest/JSON/CSV). Leave the pipeline untouched and working. If you truly can't find any clips, generate a small synthetic placeholder pack (sirens, chirps, boings synthesized in code) so development isn't blocked, and log it.
2. Write docs/SPEC.md (a faithful copy of this prompt), docs/DECISIONS.md, and a root AGENTS.md (commands, conventions, definition of done, "read docs/SPEC.md first") so future runs keep full context.
3. The clips are UNLABELED. The game must run on ids/filenames alone; title, emoji, tags and difficulty are optional fields I'll fill in later.

## Principles
- Party first: instantly readable, loud, funny, forgiving. A kid or a non-singer with any voice range should be able to score well by committing to the bit.
- Private by default: mic audio never leaves the device except, in Room mode, to the host screen in the same room. No accounts, no database, no analytics.
- Data-driven: modes, Chaos Cards, stage themes, roast lines, strings and sound packs are plain modules/JSON. Adding one never touches engine code.
- Region packs: a pack = clips + stage theme + strings. Tamil is pack #1; a Malayalam/Hindi/Telugu pack must be a folder drop-in.
- Clips stay out of git by default (gitignored packs/ folder + manifest). All UI SFX/music are synthesized with Web Audio or CC0; fonts are OFL and self-hosted.
- Clean code: strict TypeScript, no any, small modules, DSP math commented.

## Stack & layout
TypeScript (strict), Vite, React + Zustand for UI/state, vanilla Three.js for the arena (an imperative ArenaRenderer driven by game-state events; no React inside the render loop), Web Audio + AudioWorklet, Node + ws for the room relay, Vitest, Playwright, pnpm workspaces, ESLint + Prettier.
Layout: apps/veel-veel (client) · apps/server (room relay) · packages/dsp (pure TS analysis + scoring, no DOM, runs in browser AND Node) · packages/protocol (zod message schemas) · packs/<pack-id>/ (normalized clips, pack.json, features) · scripts/ · docs/.
The dev server runs over HTTPS (phones need a secure context for mic access): @vitejs/plugin-basic-ssl or mkcert, a QR code of the LAN URL printed in the terminal, docs for trusting the cert on iOS/Android, and a cloudflared/ngrok alternative.

## The arena — "Thiruvizha Night" (default theme)
A night-time Tamil street-festival stage, built procedurally in Three.js (stylized low-poly, toon-shaded with inverted-hull outlines, no external models or textures needed):
- Stage: raised platform with a glowing kolam floor pattern that fills with each singer's colour as they score; bulb strings and tube-light arches; horn speakers on poles; a flex-banner backdrop plus a big LED screen (reference waveform, scores, roast lines); moving-head spotlights; confetti cannons; marigold garlands. Festival lighting only, no religious iconography.
- 5 singer slots in a shallow arc, each with a boom-arm mic stand, a colour + shape identity (circle/triangle/square/diamond/star, colour-blind safe), nameplate, spotlight, and a ring VU meter around the mic that pulses with live input level. In turn-based modes the active singer steps to a centre mic while the others do backup-dancer loops.
- Singers: procedural characters with a customiser (8+ skin tones; long/bun/curly/short/bald hair; outfits like veshti-shirt, saree-drape, hoodie, tracksuit; aviators, garland, cap, chain). Animation: idle sway, beat-bob, mic-hold pose, mouth shapes (closed/open/round/wide) driven by live amplitude + spectral centroid, brow raises on pitch peaks, arm gestures on onsets, sweat drops on silence, on-fire glow on streaks, face-plant on flops, podium victory dance.
- Judges' dais (stage left): Anna (rhythm), Akka (melody), Paati (vibe). Scorecards, reactions (nod, facepalm, standing ovation, falling asleep) driven by their own sub-score, and Paati's blunt-but-loving roast lines loaded from a JSON file.
- Crowd: 200-300 instanced fans with a vertex-shader bounce. Crowd energy follows the live score; they whistle, wave phone lights, throw tomatoes and chappals at flops, and at peak energy chant "once more!" (unlocks an Encore bonus round).
- Camera director: establishing shot → push-in on the active singer → whip-pan to the judges → dolly-zoom on the winner; slow-mo on reveals; respects reduced-motion.
- Post-processing: bloom, vignette, light grain. Auto quality presets (Low/Med/High) from measured FPS; ≤ ~200 draw calls; the arena chunk is lazy-loaded so the lobby is instant. Support ?quality=low&e2e=1 for CI.
- A second theme, "FDFS Theatre" (first-day-first-show fan-club cinema hall), proves themes are config-driven: palette, props, banner text, crowd density, lighting rig.
- A dev page /arena to trigger every reaction, feed fake mic levels, swap themes and preview camera shots.

## UI / UX
Design language: flex-banner poster energy. Chunky condensed display type, saturated magenta/teal/turmeric on deep night blue, big tap targets, springy motion. Juice everywhere: scores count up with tick sounds, hit-stop and screen shake on drops, confetti physics, nothing static for more than ~2 s.
Flow: Splash (tap to start; unlocks audio) → Home (Play Local · Host Room · Join Room · Daily Stage · Settings) → Mic Setup wizard (pick device, live meter, 1 s noise-floor calibration, a "say Veel Veel!" test that sets the gate, headphone tip) → Lobby (5 seats: avatar customiser, name, ready; bots fill empty seats; pick mode, rounds, difficulty, pack; Chaos Cards on/off; Room mode shows code + QR) → Mode Select (animated cards) → Round HUD → Judge Reveal → Results → Rematch.
- Round HUD: reference waveform with a "listen" state; a scrolling voice-shape lane where the reference contour is a ghost line and each singer's live contour is a glowing trail; ring VUs; timer; scoreboard tower; toasts.
- Judge Reveal: Rhythm, Melody, Energy, Vibe animate in one by one with judge reactions, a total, a roast/praise line, and a take-vs-reference overlay.
- Results: podium in the 3D arena; awards (Best Copycat, Worst Copycat, Loudest Legend, Silent Assassin, Chain Breaker, Fastest Starter, Most Improved); share-card PNG (canvas, no audio); "Replay the Roast".
- Accessibility: full keyboard nav, focus states, ARIA labels, captions for clip playback, reduced-motion and high-contrast toggles. All copy lives in strings/en.ts (+ a stub strings/ta.ts); nothing hardcoded. Self-host a chunky display font and Noto Sans Tamil so Tamil script renders correctly.

## Audio engine & scoring (packages/dsp — the heart of the game; make it excellent)
- Capture: getUserMedia with noiseSuppression:false, autoGainControl:false, mono; echoCancellation only when the reference plays while recording. AudioWorklet capture → downsample (with anti-alias filter) to 22.05 kHz mono Int16 PCM, max 8 s. No MediaRecorder (iOS Safari safe; raw PCM also lets us reverse/pitch-shift takes for roasts). The reference is silent while recording in turn modes. Schedule with AudioContext.currentTime; auto-trim leading silence in the take so reaction time isn't punished unless a mode says so.
- Features (10 ms hop): log-energy envelope, onset strength, pitch (YIN or McLeod) with voicing confidence, spectral centroid, 13 MFCCs. Precompute reference features in pnpm pack:index using the SAME dsp code as the browser; cache in IndexedDB.
- Scoring judges "voice shape", not absolute pitch, so any voice can win:
  - Rhythm (~35%): onset alignment + envelope DTW (Sakoe-Chiba band), tolerant to about ±15% tempo.
  - Melody (~25%): pitch contour in cents relative to each track's own median, octave-folded, DTW; auto down-weighted on unvoiced/noisy clips.
  - Energy (~20%): per-track-normalized loudness contour correlation.
  - Vibe (~20%): MFCC timbre distance (cepstral mean normalized) + commitment (activity coverage, duration ratio).
  Reweight per clip from its own character (voicedness, dynamics). Map to a generous party curve: honest attempts land ~40-90, 95+ is rare but reachable. All weights/curves live in scoring.config.ts. Anti-cheese: silence → 0 with a friendly "mic too quiet" prompt; flat noise and clapping score low; length-ratio penalty.
- Must-pass unit tests (synthetic + real clips): take identical to the reference ≥ 95; transposed ±5 semitones ≥ 80; time-stretched ±15% ≥ 75; white noise ≤ 25; silence = 0; browser and Node results agree within tolerance. Add a dev overlay (press ~) showing features, DTW alignment path and sub-scores for tuning.
- Clip picker: difficulty ramps across rounds, no repeats in a session, skips excluded/banned clips, filters by tags once labels exist.
- Procedural SFX (Web Audio, no files): countdown, buzzer, gavel, whoosh, confetti pop, cheer/boo (filtered noise driven by crowd energy), trapdoor, feedback squeal; an optional quiet synthesized lobby groove with a mute toggle.
- Playback Roast: after each round, replay takes on the 3D singers (mouths lip-synced to the actual audio) with random FX (chipmunk, deep, megaphone, echo, reverse); at game end auto-build a highlight reel of the best, worst and funniest takes.

## Modes
Each mode is a self-contained module implementing a typed state machine over shared phases (briefing → listen → perform → judge → reveal → interlude → results), so adding a mode never touches the engine. Interface sketch: GameMode { id, name, tagline, players{min,max}, needs?: ['privateAudio'], init(ctx), phases, computeAwards(state) }.
1. MIC DROP (classic). 5/8/12 rounds. Everyone hears the clip twice, 3-2-1, then sings. Room mode: all at once; Local mode: pass-the-mic turns. Each player gets one Golden Buzzer per game: double your round score, but under 40 halves it. Last place draws a Chaos Card to inflict on the next round. Peak crowd energy triggers an Encore bonus round.
2. LAST VOICE STANDING (elimination). Each round the lowest scorer drops through a trapdoor and becomes a Heckler: from the crowd they throw tomatoes/confetti, boo or cheer, and pick the next Chaos Card. The final two face a sudden-death duel on a hard clip. Nobody sits out bored.
3. SOUND WHISPERS (telephone). Singer 1 hears the original; singer 2 hears only singer 1's take; and so on down the chain. Finale: the whole chain plays back-to-back with a mutation map showing how the sound drifted. Points for fidelity per hop and for the final distance from the original; awards for Chain Breaker and Most Faithful Copy. Needs private audio (Local mode: a "Headphone Handoff" screen).
4. ASAL / NAKAL (original vs copy). The real clip is secretly mixed in with the players' takes behind a curtain (Take A-F). Everyone votes for the one they think is the real thing (not their own). +100 for spotting it, +50 for every vote your take steals. Curtain-drop reveal with confetti.
5. VOICE CHARADES. The performer hears a clip privately and mimics it; the others see six candidate clip cards (play button on each) and race to pick the match. Works on unlabeled clips. Needs private audio.
6. DAILY STAGE (solo). Three clips seeded by the date, identical for everyone, with an emoji-grid share result.

CHAOS CARDS (data-driven; each declares how it transforms playback, expected features, scoring config and HUD): Chipmunk, Bass Boss, Reverse, Half-Speed, Double-Speed, One-Listen, No-Peek (hides the ghost line), Whisper Round (loudness penalized), Volume Boss (energy weight up), Blind Stage (lights off), Echo Cave (wet reference), Double Trouble (two clips in one take), Steal (round winner takes 10 pts from a rival), Tomato Time (lowest scorer -10).

BOTS: named bot singers with personalities fill empty seats. They produce plausible scores and audible degraded takes (pitch/tempo drift + noise on the reference), so solo/local games are never empty.

## Room mode (Jackbox-style: laptop/TV = arena, phones = mics) — build in M3, design for it now
- The host screen creates a room (4-letter code, no ambiguous letters) and a QR to /j/CODE. Phones join with name + avatar and become that singer's controller: big mic button, live level meter, ready, votes, Chaos Card picks, tomato/confetti taps for Hecklers, private-audio playback, screen wake-lock.
- Host-authoritative: game logic runs on the host client; the Node + ws server is a dumb relay + room registry. Typed, versioned, zod-validated messages (packages/protocol), rejoin tokens for phone reconnects, room TTL, rate limits, size caps. Document in docs/PROTOCOL.md.
- Controllers analyze audio locally and upload compact feature tracks + the PCM take (≤ ~350 KB); the host scores with the same dsp package. LocalTransport and WebSocketTransport sit behind one interface so Local and Room modes share one code path. Live levels stream at ~15 Hz to drive mouths and VU rings.
- Simultaneous singing in one room means voices bleed between phones: calibrate a per-player "own voice" level in Mic Setup, gate out quieter frames, tell players to hold the phone at mouth distance like a real mic, show a "too much bleed" warning from an SNR estimate, and offer "Take Turns" as a host setting.

## Milestones
- M0 Foundations: workspace scaffold; pack indexer (pnpm pack:index: source folder configurable, loudness-normalize, trim silence, flag clips > 8 s and exclude them from default rotation, auto difficulty 1-5, precompute features, emit pack.json into packs/<pack-id>/); packages/dsp with the must-pass tests green; docs + AGENTS.md.
- M1 Arena + shell: the full 3D arena above, /arena sandbox, design system, Home / Mic Setup / Lobby / Settings screens, strings + font pipeline.
- M2 Playable Mic Drop (Local mode): real mic capture, scoring, HUD with ghost/trail lane, Judge Reveal, standings, results, bots, Golden Buzzer, first 6 Chaos Cards (Chipmunk, Reverse, Double-Speed, No-Peek, Whisper Round, Tomato Time), Playback Roast v1. Playwright e2e: launch Chromium with --use-fake-device-for-media-stream, --use-fake-ui-for-media-stream and --use-file-for-fake-audio-capture pointing at a real clip converted to WAV; play a full Mic Drop and assert that a take identical to the reference scores ≥ 90.
- LATER (don't build now, don't design against): M3 Room mode + Last Voice Standing · M4 Sound Whispers, Asal/Nakal, Voice Charades, Daily Stage · M5 Clip Lab (fast tagging tool: audition, loop, trim, title, emoji, tags, difficulty, ban, hotkeys; writes pack.labels.json), scoring playground, Remix Riot (co-op mode: each singer mimics a different clip and the game quantizes the takes into a step-sequencer loop), Dockerfile/deploy.

## Definition of done (this run)
- Fresh clone: pnpm install && pnpm dev → Home → Local → Mic Setup → 5-round Mic Drop → podium, with no console errors.
- pnpm test, lint, typecheck, build and e2e all green (or a precise note on what your sandbox couldn't run).
- docs/screens/*.png for Home, Lobby, Arena (both themes), HUD, Judge Reveal, Podium.
- Targets: 60 fps at 1080p on an integrated-GPU laptop in Medium quality; lobby bundle small with Three.js lazy-loaded.
- Commit at the end of each milestone. Final report: what works, what's stubbed, measured FPS/draw calls/bundle sizes, top 5 risks, and the exact prompt you recommend for M3.

Start with Step 0.