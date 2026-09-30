# Veel Veel

Veel Veel is a browser voice-mimic party game with a procedural festival/theatre arena, local Mic Drop, and room Mic Drop for up to five phone singers on a reachable network. Room hosts can choose simultaneous singing or turns; each singer sees rhythm, melody, energy and vibe scores.

```powershell
pnpm install
pnpm dev
```

`pnpm dev` indexes clips into the ignored `packs/` folder, then starts the HTTPS game on port 5173 and a secure room relay on port 8787. Open the local address for **Play Local**, **Host Room**, or **Join Room**. The current local Tamil pack contains 534 unlabeled clip IDs; a fresh checkout without local source media creates twelve synthesized demo clips. See [local setup](docs/LOCAL_DEV.md), [sound additions](docs/CLIPS.md), [room protocol](docs/PROTOCOL.md), [hosting](docs/DEPLOY.md), and [current status](docs/STATUS.md).

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
