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
