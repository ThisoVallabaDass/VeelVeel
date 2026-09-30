# Hosting the room game

The Node app in `apps/server` serves the built client and generated pack, and owns the WebSocket room relay. The local development link works only on this computer or its reachable LAN. The owner has chosen local play first; no public domain or hosting account is configured.

For a public deployment:

1. Provide sound files cleared for public distribution under `data/` before building, or use the generated demo pack. The local 534-clip library is ignored by Git and is not present in a clean checkout.
2. Run `pnpm install --frozen-lockfile` and `pnpm build`, or build the included `Dockerfile` from a context containing the cleared source clips. Keep `apps/veel-veel/dist/`, `packs/`, `apps/server/dist/`, `packages/` and installed production dependencies available to the process.
3. Start the relay with `NODE_ENV=production PORT=8787 pnpm --filter @veel-veel/server start` on a Node 24 host.
4. Put an HTTPS reverse proxy in front of it. Forward ordinary requests and WebSocket upgrades on `/room` to port 8787. Use a certificate trusted by browsers; microphone access requires a secure context.
5. Run one server instance unless you add shared room state and sticky routing. Rooms and audio remain in memory on that instance.

The `GET /health` endpoint reports process health and room count. The server does not persist voice recordings, accounts or analytics. Public hosting has not been exercised or provisioned yet, so there is no public URL.
