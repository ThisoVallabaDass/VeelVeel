# Sound clips

The current local library contains 534 unlabeled clips from the owner's existing Tamil source dataset. They were collected from YouTube; source URLs remain in the ignored pack manifest. The source titles do not establish redistribution rights, so the repository does not publish the recordings.

Tamil and English clips are both supported. To add clips you have permission to use:

1. Put mono or stereo PCM WAV files under `data/clips/wav/` (this directory is ignored by Git).
2. Add one JSON object per line to `data/catalog/extra-clips.jsonl`, for example:

   ```json
   {"clip_id":"my-original-voice-01","wav_path":"data/clips/wav/my-original-voice-01.wav","language":"en","video_title":"Original voice line","source_url":""}
   ```

3. Run `pnpm pack:index`. The indexer trims, normalizes and converts clips to mono 22.05 kHz WAV, writes voice features, ranks difficulty, and excludes clips longer than eight seconds from default rotation. It does not infer labels or language. Set `language` to `ta` or `en` yourself.

The existing Python harvester is separate and remains available. Do not add social media clips to a public build until their use and distribution are cleared. The game does not fetch TikTok, Instagram or YouTube media at runtime.


## Curated vocal import (October 2026)

Run `python scripts/import-sounds.py` then `pnpm pack:index`. The importer reads `scripts/sound-sources.json`, downloads each selected source once with yt-dlp, cuts it with ffmpeg to mono PCM16, and merges by clip ID into `data/catalog/extra-clips.jsonl`. Re-running is idempotent. Source files are cached under `.cache/imports`; game-ready sources are under `data/clips/wav/party-vocals`.

The 56 selected entries include sixteen vocal excerpts using the owner's exact compilation timestamps. Speech, laughter, screams and sung phrases are selected by labels. Pipes, glass, bells, startup sounds, sirens and instrument-only effects are excluded. Labels are source/title based; this is not an automatic speech classifier. The requested Tamil short uses a provisional opening cut that still needs audition for precise alignment. Public metadata preserves titles, languages/categories, time ranges, source URLs and unverified-source rights status.

Room play defaults to the curated `human-vocal` entries when enough exist. The older library is preserved for Local play. English meme categorization includes some international meme vocals; it is not a claim that every excerpt is spoken English. Do not commit media or generated packs.
