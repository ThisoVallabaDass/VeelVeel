# Hosting Veel Veel

## Current public playtest

Build with `pnpm build`, then run `powershell -ExecutionPolicy Bypass -File scripts/start-public.ps1`. The script starts the production server on port 8788 and a Cloudflare Quick Tunnel as hidden background processes. It prints the temporary HTTPS URL and records it in `.cache/public-url.txt`. Process IDs and logs are in `.cache/public-processes.json`, `.cache/public-server*.log` and `.cache/public-tunnel*.log`.

This link works only while this computer, the Node process and the tunnel stay running and online. It is a playtest link with no uptime guarantee. Restarting the tunnel changes the URL. To stop it, inspect the recorded process IDs and stop those two processes in Task Manager. Do not start duplicate instances on the same port.

## Permanent hosting

`render.yaml` defines one Docker web service, initially on Render's free plan. Connect this repository in your Render account and create a Blueprint service. The service owns HTTP and WebSocket `/room` on the same port; `/health` is its health check. Render supplies a trusted HTTPS address. Free services can sleep when idle; use a paid instance if you need continuous availability. No Render account or billable service was created by this change.

The Dockerfile also works on any Node-capable container host. Keep one replica: room state and recordings are in memory and have no shared store. Preserve the public Host header through the HTTPS reverse proxy and forward WebSocket upgrades.

Source audio and generated packs are deliberately gitignored. A clean Git deployment therefore generates a synthetic demo pack unless you provide the source dataset in the build context. Run `python scripts/import-sounds.py` locally to reproduce curated additions, then `pnpm pack:index`. Source provenance is recorded, but those YouTube excerpts do not come with verified redistribution licences. The pre-existing public-release requirement remains: use cleared media for a permanent release.

Production start: `NODE_ENV=production PORT=8787 node apps/server/dist/index.js` (set environment variables using your shell/platform). `pnpm build` must run first. The Node app serves client assets, generated pack and relay together. No database, account storage or analytics are used.

## Verification

`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm e2e`. To test a deployed endpoint, set `VEEL_E2E_BASE_URL` to its HTTPS URL before running Playwright. Tests cover local play, automatic two-player rounds, five-player rooms, sixth-player rejection, host participation, chat muting, and reconnect identity. Relay tests additionally verify score masking and playback-before-score ordering.
