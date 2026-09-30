# Veel Veel contributor guide

**Read `docs/SPEC.md` first.** The product brief is the source of truth for scope and behavior. The owner has since requested online room play, expanded sounds, scoring and stage animation. `docs/STATUS.md` records what is implemented and what remains.

## Commands

- Install: `pnpm install`
- Generate the Tamil pack: `pnpm pack:index`
- Start HTTPS LAN development (game and room relay): `pnpm dev`
- Quality checks: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm e2e`
- Python data pipeline (separate from the game): `python -m sound_harvest run`

## Conventions

- Strict TypeScript. Keep DSP pure and platform-independent under `packages/dsp`.
- Keep pack content, labels, modes, chaos cards, themes, judges and copy data-driven.
- Mic PCM stays in memory on the device in Local mode. Never add analytics or account storage.
- Keep game code under `apps/` and reusable packages under `packages/`.
- Do not commit media or generated packs. `data/` and `packs/` are gitignored.
- Use accessible semantic controls, keyboard navigation, reduced-motion support and color-plus-shape identities.
- Arena rendering is imperative Three.js and must not depend on React inside its animation loop.
- Add or update focused Vitest/Playwright coverage with behavior changes.
- Add important product/architecture tradeoffs to `docs/DECISIONS.md`.

## Current milestone boundary

Local and room Mic Drop are playable. Other modes and public deployment remain open work; do not present them as finished. See `docs/STATUS.md`.
