# Veel Veel

[Play online](https://veel-veel.onrender.com/) · 2–5 singers · free hosting

[Deploy to Render](https://render.com/deploy?repo=https://github.com/ThisoVallabaDass/VeelVeel)

Uses the checked-in Docker/Render configuration. The sound-bundle URL and checksum are already configured. Sign into Render, review the free service, and deploy.


Veel Veel is a browser voice-mimic party game with a procedural festival/theatre arena and room Mic Drop for up to five singers. The host joins the lineup by default, or can run the room as an audience member. Guests can sing or watch from their phones. Each singer sees rhythm, melody, energy and vibe scores.

```powershell
pnpm install
pnpm dev
```

`pnpm dev` indexes clips into the ignored `packs/` folder, then starts the HTTPS game on port 5173 and a secure room relay on port 8787. Open the local address for **Host Room** or **Join Room**. The current workspace pack contains 590 Tamil/English meme clips, including 56 labelled vocal additions; a fresh checkout without local source media creates twelve synthesized demo clips. See [local setup](docs/LOCAL_DEV.md), [sound additions](docs/CLIPS.md), [room protocol](docs/PROTOCOL.md), [hosting](docs/DEPLOY.md), and [current status](docs/STATUS.md).

Game checks: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm e2e`.

## Dataset pipeline

The separate Python pipeline prepares a manually labeled library of short Tamil meme and reaction sounds. It never transcribes, classifies, detects language, or fills label fields. All generated clip names are IDs, not inferred descriptions.

## Setup

Requires Python 3.11+, `ffmpeg`/`ffprobe`, and the packages in `requirements.txt`.

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -U pip
python -m pip install -r requirements.txt
```

Install FFmpeg if it is not already available on PATH:

- Windows: `winget install Gyan.FFmpeg` (then open a new terminal).
- macOS: `brew install ffmpeg`.
- Debian/Ubuntu: `sudo apt update && sudo apt install ffmpeg`.
- Fedora: `sudo dnf install ffmpeg`.

Set `YT_COOKIES_FROM_BROWSER` to a yt-dlp browser name only if access to a source requires your logged-in browser session. Cookies are optional.

## Commands

Run from this directory with `python -m sound_harvest` (or `python -m sound_harvest run`). `--limit N` limits enumeration/download/split to N unique videos, useful for a smoke run.

- `enumerate`: normalize `sources.txt`, expand playlists, deduplicate videos by ID, save metadata in `data/meta/` and `data/state/videos.jsonl`.
- `download`: fetch best audio only, sequentially, with retries and a download archive.
- `split`: segment downloaded audio into mono 44.1 kHz PCM WAV masters and quality-5 Vorbis OGGs. Use `--force-resplit` after changing segmentation settings; existing clips are protected otherwise.
- `catalog`: regenerate machine-owned `clips.jsonl`, `clips.csv`, and `videos.jsonl`; append missing IDs to `data/labels.csv` while preserving existing handwritten values (a `.bak` copy is made before modifying an existing label file).
- `report`: write `data/reports/summary.md` and waveform plots with clip boundaries.
- `export-pack`: optionally join catalog and labels and export kept, titled rows using `reference/veel-veel-tamil-pack.json` as the schema template. No label values are invented.
- `run`: enumerate, download, split, catalog, and report in order.

Examples:

```powershell
python -m sound_harvest enumerate
python -m sound_harvest run --limit 4
python -m sound_harvest run
python -m sound_harvest download   # resume after throttling/blocking
python -m sound_harvest split --force-resplit
```

Failed videos are logged to `data/catalog/failed_videos.jsonl`; rejected audio segments and reasons are retained under `data/rejected/`. Raw audio is never deleted or overwritten. All generated media and state are ignored by Git under `data/`.

## Tuning and labeling

Edit `config.yaml` to tune RMS gate, silence duration, clip lengths, padding, fades, normalization and per-video `trim_head_s`, `trim_tail_s`, or `skip_ranges`. A configuration fingerprint is stored on each clip; changing it requires `--force-resplit`, which backs up the label sheet before rewriting any clip-derived rows. Clip IDs use the detected unpadded source start, rounded to 10 ms.

Edit `data/labels.csv` by hand. Its columns are `clip_id, keep, title, title_ta, category, kind, profile, difficulty, funny, region, notes, status`. The pipeline only appends rows for new IDs and never replaces existing labels. Keep media local; do not commit it.

## Resume and assumptions

Rerunning stages is safe: yt-dlp uses `data/state/download_archive.txt`, and splitting uses `data/state/processed.json`. Playlist sources are normalized to playlist URLs, the single source remains a single video, and duplicate video IDs retain all source playlist IDs. Smoke testing is intended before the complete run. Extraction errors are logged per video and the run continues. FFmpeg is external; a media stage stops with platform-specific install guidance if either binary is missing.


## Online party playtest

Room Mic Drop supports 2–5 singers: everyone listens together, records together, and hears each take before its score. Voice chat has Off, Always on and Push to talk, with automatic round muting. Use **Host Room**, optionally join as a singer, share the invite, connect microphones and ready up.

Import curated additions with `python scripts/import-sounds.py`, then run `pnpm build`. On Windows, `powershell -ExecutionPolicy Bypass -File scripts/start-public.ps1` publishes a temporary HTTPS link while this computer stays online. See `docs/DEPLOY.md` for permanent hosting and dataset requirements.


Sound deployment: `pnpm pack:bundle` creates a separate audio release under `.cache/releases/`. Upload that asset to stable HTTPS storage and set Render's `SOUND_PACK_URL`; the current digest is pinned in `render.yaml`. Docker uses `pnpm build:deploy` to restore and verify it before building. Missing or invalid bundles stop deployment. See `docs/DEPLOY.md` for the prepared release and rights status.

During each room reveal, players can label a sound as a laugh, dialogue, catchphrase, singing, sound effect, animal, crowd, or add a category. Votes contain only the sound ID and label, and `/api/sound-labels` returns aggregate JSON for human curation. Set `LABELS_FILE` to a persistent mounted path to keep votes across service restarts; the current Render free filesystem does not persist them. Votes do not include recordings, names, or other personal data. To promote labels with at least three votes and 60% agreement into sound metadata, download the JSON from `/api/sound-labels` and run `pnpm labels:apply votes.json [catalog.jsonl]`. Then build the pack using the generated `.categorized.jsonl` manifest. Category-aware scoring adjusts weights for speech, singing, sound effects and crowd sounds.

For more clips, prefer original recordings or individually verified CC0/public-domain sounds. Freesound's files use multiple licenses; verify each file's license and attribution details before including it. Copyrighted anime and movie dialogue should only be added after securing distribution rights. A license directory and credits must ship with any imported sounds.
