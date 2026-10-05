# Hosting Veel Veel

## Live game

Play at https://veel-veel.onrender.com. Render hosts the game and room relay on the free plan; idle services can take about a minute to wake. The full 590-clip bundle is included in the Docker image.

## Optional local public playtest

Build with `pnpm build`, then run `powershell -ExecutionPolicy Bypass -File scripts/start-public.ps1`. The script starts the production server on port 8788 and a Cloudflare Quick Tunnel as hidden background processes. It prints the temporary HTTPS URL and records it in `.cache/public-url.txt`. Process IDs and logs are in `.cache/public-processes.json`, `.cache/public-server*.log` and `.cache/public-tunnel*.log`.

This link works only while this computer, the Node process and the tunnel stay running and online. It is a playtest link with no uptime guarantee. Restarting the tunnel changes the URL. To stop it, inspect the recorded process IDs and stop those two processes in Task Manager. Do not start duplicate instances on the same port.

## Permanent hosting

`render.yaml` defines one Docker web service, initially on Render's free plan. Connect this repository in your Render account and create a Blueprint service. The service owns HTTP and WebSocket `/room` on the same port; `/health` is its health check. Render supplies a trusted HTTPS address. Free services can sleep when idle; use a paid instance if you need continuous availability. No Render account or billable service was created by this change.

The Dockerfile also works on any Node-capable container host. Keep one replica: room state and recordings are in memory and have no shared store. Preserve the public Host header through the HTTPS reverse proxy and forward WebSocket upgrades.

Source audio and generated packs are deliberately gitignored. Production Docker builds now run `pnpm build:deploy`: restore a checksum-pinned sound bundle, then build the client and server. They fail if the bundle URL/checksum is missing or invalid; they cannot silently deploy a demo library. Ordinary `pnpm build` and local development retain the synthesized fallback.

### Published sound release

The current release is published at [GitHub soundpack-v1](https://github.com/ThisoVallabaDass/VeelVeel/releases/tag/soundpack-v1), with local copy `.cache/releases/veel-sounds-v1.jsonl.gz` (181,734,257 bytes, about 182 MB). It contains 590 normalized clips, their DSP feature JSON and the pack manifest: 1,181 files total. Existing labels, source URLs, exclusions and rights metadata are preserved. 452 clips are eligible for rotation, including 55 new playable vocals. No microphone recordings or raw downloads are included. The archive, checksum file and upload instructions are ignored by Git; only the small `docs/sound-bundle-release.json` record is tracked.

1. Review redistribution permission for the selected audio. All 590 current clips remain unverified; packaging does not clear rights.
2. Upload the `.jsonl.gz` file as a release asset on a **public** GitHub repository, or to object storage with a stable HTTPS URL that the build can access without authentication. Do not commit the binary to Git. Private GitHub release links cannot be fetched by this downloader.
3. Both `SOUND_PACK_URL` and `SOUND_PACK_SHA256` are now pinned in `render.yaml` for the published GitHub bundle. Future releases must update both values. Render passes these environment variables to the Docker build arguments.
4. Deploy. The importer streams the download, verifies its SHA-256, checks individual file hashes, permits only pack JSON/WAV/feature files, checks manifest completeness, and restores into `packs/tamil-meme`. The worklet comes from the repository, never the audio archive. Existing output libraries are not overwritten. The bundle is embedded in the image, so playback does not depend on the asset host after deployment.

To regenerate after sound changes: `pnpm pack:index` then `pnpm pack:bundle`. Upload the new artifact and update both the URL and digest in Render. To validate a local bundle without touching current sounds:

```powershell
$bundleSha = (Get-Content .cache/releases/veel-sounds-v1.jsonl.gz.sha256).Split(' ')[0]
pnpm pack:restore --file .cache/releases/veel-sounds-v1.jsonl.gz --sha256 $bundleSha --out .cache/new-sound-proof
```

Use a fresh output directory for each restore. Docker builds exclude raw `data/` and local `packs/`, keeping the verified release as their only sound source. Docker was not available locally during preparation; the same export/restore code was exercised against the complete real library and in focused tests.

Production start: `NODE_ENV=production PORT=8787 node apps/server/dist/index.js` (set environment variables using your shell/platform). `pnpm build` must run first. The Node app serves client assets, generated pack and relay together. No database, account storage or analytics are used.

## Verification

`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm e2e`. To test a deployed endpoint, set `VEEL_E2E_BASE_URL` to its HTTPS URL before running Playwright. Tests cover local play, automatic two-player rounds, five-player rooms, sixth-player rejection, host participation, chat muting, and reconnect identity. Relay tests additionally verify score masking and playback-before-score ordering.
