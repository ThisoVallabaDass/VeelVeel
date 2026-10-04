import { afterEach, expect, test, vi } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { downloadBundle, exportBundle, hashFile, restoreBundle } from './sound-bundle.js';

const directories: string[] = [];
async function directory() { const value = await mkdtemp(path.join(tmpdir(), 'veel-bundle-')); directories.push(value); return value; }
afterEach(async () => { vi.unstubAllGlobals(); await Promise.all(directories.splice(0).map((d) => rm(d, { recursive: true, force: true }))); });
async function fixture() {
  const root = await directory();
  const source = path.join(root, 'source');
  await mkdir(path.join(source, 'clips'), { recursive: true });
  await mkdir(path.join(source, 'features'));
  await writeFile(path.join(source, 'pack.json'), JSON.stringify({ id: 'tamil-meme', clipCount: 1, clips: [{ id: 'hello', title: 'Hello / வணக்கம்', audio: 'clips/hello.wav', features: 'features/hello.json', rights: 'unverified-source' }] }));
  await writeFile(path.join(source, 'clips/hello.wav'), Buffer.from([82, 73, 70, 70, 0, 255]));
  await writeFile(path.join(source, 'features/hello.json'), '{"frames":[{"energy":0.2}]}');
  const file = path.join(root, 'bundle.gz');
  const report = await exportBundle(source, file);
  return { root, source, file, report };
}

test('export and restore preserve labels, exact PCM/features and unverified rights', async () => {
  const { root, source, file, report } = await fixture();
  const output = path.join(root, 'restored');
  expect(report.rights.unverified).toBe(1);
  expect((await restoreBundle(file, report.sha256, output)).files).toBe(3);
  for (const name of ['pack.json', 'clips/hello.wav', 'features/hello.json'])
    expect(await readFile(path.join(output, 'tamil-meme', name))).toEqual(await readFile(path.join(source, name)));
  await expect(restoreBundle(file, report.sha256, output)).rejects.toThrow('already exists');
});

test('checksum mismatch writes no library', async () => {
  const { root, file } = await fixture();
  const output = path.join(root, 'output');
  await expect(restoreBundle(file, '0'.repeat(64), output)).rejects.toThrow('SHA-256');
  await expect(readdir(output)).rejects.toThrow();
});

test.each(['../escape.wav', 'clips/../../escape.wav', '/absolute.wav', 'audio-capture-worklet.js'])(
  'rejects unsafe or executable archive path %s and cleans staging', async (unsafePath) => {
    const root = await directory();
    const file = path.join(root, 'bad.gz');
    await writeFile(file, gzipSync(JSON.stringify({ format: 'veel-sounds-v1', files: 3 }) + '\n' + JSON.stringify({ path: unsafePath, data: '', sha256: '' }) + '\n'));
    const output = path.join(root, 'output');
    await expect(restoreBundle(file, await hashFile(file), output)).rejects.toThrow('bundle file');
    expect(await readdir(output)).toEqual([]);
  },
);

test('a complete archive must contain every referenced asset', async () => {
  const root = await directory();
  const data = Buffer.from(JSON.stringify({ id: 'tamil-meme', clipCount: 1, clips: [{ id: 'missing', audio: 'clips/missing.wav', features: 'features/missing.json' }] }));
  const file = path.join(root, 'bad.gz');
  await writeFile(file, gzipSync(JSON.stringify({ format: 'veel-sounds-v1', files: 3 }) + '\n' + JSON.stringify({ path: 'pack.json', data: data.toString('base64'), sha256: createHash('sha256').update(data).digest('hex') }) + '\n'));
  await expect(restoreBundle(file, await hashFile(file), path.join(root, 'output'))).rejects.toThrow('Incomplete');
});

test('download follows HTTPS redirects and writes the received archive unchanged', async () => {
  const { root, file, report } = await fixture();
  const contents = await readFile(file);
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://storage.example/asset' } })).mockResolvedValueOnce(new Response(contents));
  vi.stubGlobal('fetch', fetcher);
  const downloaded = path.join(root, 'downloaded.gz');
  await downloadBundle('https://release.example/bundle.gz', downloaded);
  expect(await hashFile(downloaded)).toBe(report.sha256);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test('download rejects an HTTPS-to-HTTP downgrade', async () => {
  const root = await directory();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://storage.example/asset' } })));
  await expect(downloadBundle('https://release.example/bundle.gz', path.join(root, 'download.gz'))).rejects.toThrow('HTTPS');
});
