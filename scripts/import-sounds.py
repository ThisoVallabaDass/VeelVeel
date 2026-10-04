"""Import the owner's curated, labelled vocal excerpts without changing the harvester.

Requires yt-dlp and ffmpeg on PATH. Media stays in ignored directories. Re-running
is idempotent; source provenance and deliberate cuts live in sound-sources.json.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run():
    spec = json.loads((ROOT / 'scripts/sound-sources.json').read_text(encoding='utf-8'))
    cache = ROOT / '.cache/imports'
    cache.mkdir(parents=True, exist_ok=True)
    output = ROOT / 'data/clips/wav/party-vocals'
    output.mkdir(parents=True, exist_ok=True)
    catalog = ROOT / 'data/catalog/extra-clips.jsonl'
    catalog.parent.mkdir(parents=True, exist_ok=True)
    previous = [json.loads(line) for line in catalog.read_text(encoding='utf-8').splitlines() if line] if catalog.exists() else []
    records = {row['clip_id']: row for row in previous}
    failures = []
    for clip in spec['clips']:
        video = clip['video']
        source = f'https://www.youtube.com/watch?v={video}'
        raw = cache / f'{video}.wav'
        ident = f"vocal-{video}-{int(clip['start'] * 1000)}"
        try:
            if not raw.exists():
                subprocess.run(['yt-dlp', '--js-runtimes', 'node', '--no-playlist', '--no-progress', '-f', 'bestaudio', '-x', '--audio-format', 'wav', '--write-info-json', '-o', str(cache / '%(id)s.%(ext)s'), source], check=True)
            target = output / f'{ident}.wav'
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(clip['start']), '-i', str(raw), '-t', str(clip['end'] - clip['start']), '-ac', '1', '-ar', '22050', '-c:a', 'pcm_s16le', str(target)], check=True)
            records[ident] = dict(clip_id=ident, wav_path=target.relative_to(ROOT).as_posix(), video_title=clip['title'], title=clip['title'], language=clip['language'], source_url=source, start_s=clip['start'], end_s=clip['end'], flags=['human-vocal'], rights='unverified-source', selection=clip['selection'])
        except subprocess.CalledProcessError:
            failures.append(video)
    catalog.write_text(''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in records.values()), encoding='utf-8')
    print(f'Imported catalog: {len(records)} clips. Failed sources: {failures}')
    if failures:
        raise SystemExit(1)


if __name__ == '__main__':
    run()
