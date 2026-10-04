import path from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { downloadBundle, exportBundle, installWorklet, restoreBundle } from './sound-bundle.js';

const root = process.cwd();
const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1] ?? fallback;
};
const bundle = path.resolve(option('--file', '.cache/releases/veel-sounds-v1.jsonl.gz'));
if (args[0] === 'export') {
  console.log(await exportBundle(path.resolve(option('--source', 'packs/tamil-meme')), bundle));
} else if (args[0] === 'restore') {
  const checksum = option('--sha256', process.env.SOUND_PACK_SHA256 ?? '');
  const destination = path.resolve(option('--out', 'packs'));
  const isLocal = args.includes('--file');
  const url = process.env.SOUND_PACK_URL;
  if (!checksum || (!isLocal && !url)) throw new Error('Set SOUND_PACK_URL and SOUND_PACK_SHA256. Production will not fall back to demo sounds.');
  const cache = path.join(root, '.cache');
  await mkdir(cache, { recursive: true });
  const download = path.join(cache, `sound-download-${randomUUID()}.gz`);
  try {
    if (!isLocal) await downloadBundle(url!, download);
    console.log(await restoreBundle(isLocal ? bundle : download, checksum, destination));
    await installWorklet(destination, root);
  } finally { if (!isLocal) await rm(download, { force: true }); }
} else throw new Error('Use export or restore.');
