# Decisions

- **Use the downloaded Tamil clips directly as pack #1.** The workspace already contains 534 WAV/OGG clips with IDs and provenance, so synthetic placeholders would reduce fidelity.
- **Keep labels blank and treat clip IDs as identity.** The existing label sheet is empty apart from `unlabeled`; the UI uses IDs until the owner fills pack labels.
- **Build a pnpm TypeScript monorepo beside the Python harvester.** This preserves the working data pipeline and keeps shared DSP usable in both browser and Node.
- **Use Local mode as the only playable mode through M2.** Room networking and other modes are explicitly deferred to M3+.
- **Initialize a local Git repository because the workspace had none.** No global Git author is configured, so milestone commits use the local identity `Veel Veel Build Agent <codex@localhost>`; no remote is added.
- **Use generated geometry and CSS rather than external models or raster art.** This keeps the arena self-contained, lightweight and easy to theme.
- **Score normalized voice shape with a forgiving multifeature alignment.** Pitch is relative and down-weighted when voice confidence is low; no speech recognition, language detection or transcription is used.
- **Rank clip difficulty within the current pack.** Raw feature complexity clustered at level five, so pack quantiles provide usable five-level setlists.
- **Use a neutral first clip before the selected difficulty ramp.** Every local game opens with a consistent warm-up, then picks distinct clips toward the chosen level.
- **Treat a missing pitch track as inconclusive when timbre, energy and rhythm strongly agree.** Device pitch trackers can lose voicing on the same audio; corroborating features prevent a false low score.
- **Keep the latest take only in browser memory until the next round.** This allows roast replay without storing or uploading voice recordings.
- **Use a CSS arena preview under `?e2e=1`.** Headless Chromium in this workspace stalls while software-rendering Three.js, so Playwright checks the game flow and themes through a static CI preview; normal play loads the Three.js scene.
- **Copy the audio worklet into the generated pack public root.** Vite serves one public directory, and the pack directory already contains the generated audio and feature files.
- **Synthesize a twelve-clip fallback when no source media is available.** Ignored media cannot be present in a fresh clone, but the local game should still start.
- **Use a separate secure WebSocket port in local development.** The Vite WebSocket proxy stalled on this Windows setup; sharing Vite's generated certificate lets phones reach the relay directly over WSS.
- **Let the host score room takes.** Phones upload one short PCM16 take through the relay, while the host uses the same DSP as Local mode and publishes scores. The relay stores only cumulative results in memory.
- **Keep the existing 534 clips and accept mixed-language additions through an extra manifest.** The owner clarified that Tamil and English meme audio are welcome; no new third-party recordings were supplied or cleared for distribution.
- **Improve pitch tracking with a 40 ms window and cap one-note matches on voiced melodies.** A synthetic one-note imitation previously scored 96 despite missing the melody.
- **Extend the procedural arena before adding external avatar assets.** Articulated walking, mouth animation and audience bounce work without a model license or additional network downloads, while realistic rigged avatars remain a separate task.
- **Expose judge sub-scores to every room player.** Total points alone made the voice comparison opaque on phones; snapshots preserve the last scored round for reconnects.
- **Let the host select among detected LAN adapters.** A single automatically chosen address can point to a VPN that phones cannot reach.
- **Offer take-turns room singing.** Simultaneous takes can pick up nearby voices; serial turns give groups a usable fallback without changing DSP or audio capture.
- **Let the host occupy one optional singer seat.** A host-only room could not start because there was no ready singer; the host can now connect a mic and play solo while screen-only hosting remains available.
- **Score the host take in the host browser.** Host mic audio does not need to pass through the relay to reach the same scoring engine.

- **The October party request supersedes solo-room and manual-turn behavior.** Public room Mic Drop now requires 2–5 ready singers and automatically schedules listening and recording together.
- **Buffer one round of PCM in relay memory.** Everyone must hear each singer's actual take; score snapshots remain masked until that take ends. Audio is cleared on the next round or room expiry, never written to disk.
- **Gate the shared round on decoded references.** A 1.5-second start lead handles ordinary network jitter; a timeout prevents failed downloads/captures blocking the party forever. True clock synchronization remains future work.
- **Relay opt-in voice chat over the existing WebSocket for the first playtest.** Short 16 kHz PCM chunks work through the same HTTPS endpoint without TURN credentials, trading bandwidth for simple connectivity. Mute is enforced on the server during listening/recording.
- **Use curated vocal additions as the room default.** Labelled speech, singing, laughter and screams are kept; mechanical effects are excluded. Existing Tamil source clips remain available to Local mode. Titles and cuts are tracked in scripts/sound-sources.json; ignored media is reproducibly imported separately.
- **Keep the supplied short's cut explicitly provisional.** YouTube's automatic captions do not align the Tamil phrase reliably. The first 7.8 seconds are imported under an opening-excerpt label and still need a Tamil speaker's audition for exact phrase boundaries.
- **Use a temporary Cloudflare HTTPS tunnel until hosting credentials are available.** It publishes the built Node app and WebSockets, but depends on this computer staying awake; the Render blueprint is an optional permanent deployment path, not an already-provisioned service.

- **Ship generated sound data as a separate checksum-pinned release asset.** A streaming gzip JSONL bundle preserves normalized WAVs, labels and precomputed DSP without committing media or requiring YouTube/ffmpeg during deployment. Production builds require a valid URL/hash; local builds retain their demo fallback.
- **Do not infer rights clearance from a successful import or package.** The release report preserves all 590 current clips as unverified; packaging and licence review are separate steps.

- **Give recording its own screen and an honest live signal.** Listening, preparation, recording and submission have separate visual states. The animated mouth and waveform follow measured audio; a silent mic does not show invented activity.
- **Gate the whole take before trimming.** Quiet background audio, DC offsets and isolated clicks must not become scoreable performances through relative normalization. Room setup measures a quiet baseline; takes need 120 ms and 8% activity above it. A noisy calibration can reject a soft singer, so setup asks everyone to stay quiet. This is activity detection, not speech recognition.
- **Remove the recording beep.** Speaker playback during capture can contaminate an otherwise silent take. The visual countdown and REC badge now signal when to sing.
- **Remove the timbre score's 85-point floor.** The old capped MFCC distance awarded a large contribution even for unrelated audio; the full distance now decays continuously.
- **Run room scoring in Web Workers.** The host must remain responsive while recording itself and scoring guests. Each request terminates its worker on completion/failure and ignores results from previous rounds.
- **Use original branding and animation.** The mic logo is generated artwork; the recording character and stage rigs are original code inspired by the supplied gameplay flow. No reference-video assets are extracted.

## 6 October 2026 — automatic sets and foreground crowd

- **Schedule the next round from a shared server reveal deadline.** The host loads the next non-repeating clip after 6.5 seconds, and the existing loaded-client barrier starts everyone together. The final intermission opens the podium. Reconnecting hosts receive the deadline in the snapshot; the room still needs its host and two ready singers.
- **Offer 5, 7, 10 and 15 rounds consistently.** Protocol version 6 permits round index 14 and keeps the selected set length fixed once play starts. Local mode keeps its pass-the-mic controls.
- **Place an instanced audience between camera and stage.** The old crowd was hidden behind the back wall, and an incorrect angular layout put every singer on the left. Symmetric slots, proper microphones, standing poses and bright confetti make reactions visible.
- **Filter captured noise without browser speech processing.** A gentle bandpass and calibrated gate preserve vocal timbre; a 200 ms hold avoids chopping between syllables. The earlier activity gate still rejects silence before normalization. Nearby voices remain a limitation.
- **Separate exact identity from browser loop-capture validation.** Pure DSP keeps the 95+ identical-source requirement, and filtered aligned source scores 90+. The browser fake microphone loops through calibration and listening, so its cut is not aligned; that end-to-end test expects 80+ plus the correct game flow.
- **Strengthen short-take penalties and adapt pitch weight.** Attempts below 65% of source duration receive an extra length penalty; weak pitch tracking shifts weight to rhythm and energy instead of a guessed melody score.

- **Make the host a singer by default and keep screen-only hosting explicit.** Most hosts want to play; an audience-only option retains a way to run the room without a mic.
- **Keep audience separate from singer seats and scores.** Viewers can join at any point and reconnect, while ready, recording and scoring remain singer-only. Limit active audience identities to 20 to bound relay memory and bandwidth.
- **Make the venue a direct two-button choice.** Stage and Theatre should be visible and understandable without opening a hidden menu; the host's room choice is sent to all clients.
- **Separate chat listening from speaking.** Muting incoming party chat should not silently disable the user's own mic. Voice chat still pauses during reference playback and recording.
