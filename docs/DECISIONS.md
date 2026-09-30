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
