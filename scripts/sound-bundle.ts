import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip, createGunzip } from 'node:zlib';

const MAX_BYTES = 512 * 1024 * 1024;
const MAX_FILE = 4 * 1024 * 1024;
const validPath = /^(?:pack\.json|clips\/[A-Za-z0-9_-]{1,128}\.wav|features\/[A-Za-z0-9_-]{1,128}\.json)$/;
interface Clip { id: string; audio: string; features: string; flags?: string[]; rights?: string }
interface Pack { id: string; clipCount: number; clips: Clip[] }
const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex');

function parsePack(data: Buffer): Pack {
  const pack = JSON.parse(data.toString('utf8')) as Pack;
  if (pack.id !== 'tamil-meme' || !Array.isArray(pack.clips) || pack.clips.length < 1 || pack.clips.length > 2000 || pack.clipCount !== pack.clips.length)
    throw new Error('Invalid sound pack manifest.');
  const ids = new Set<string>();
  for (const clip of pack.clips) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(clip.id) || clip.audio !== `clips/${clip.id}.wav` || clip.features !== `features/${clip.id}.json` || ids.has(clip.id))
      throw new Error('Invalid or duplicate clip reference.');
    ids.add(clip.id);
  }
  return pack;
}
function filesFor(pack: Pack) { return ['pack.json', ...pack.clips.flatMap((c) => [c.audio, c.features])]; }

export async function hashFile(file: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

/** Portable, streaming archive containing only the manifest and referenced sound data. */
export async function exportBundle(packDirectory: string, bundleFile: string) {
  const manifest = await readFile(path.join(packDirectory, 'pack.json'));
  const pack = parsePack(manifest);
  const files = filesFor(pack);
  async function* records() {
    yield JSON.stringify({ format: 'veel-sounds-v1', files: files.length }) + '\n';
    let total = 0;
    for (const name of files) {
      const data = await readFile(path.join(packDirectory, name));
      total += data.length;
      if (data.length > MAX_FILE || total > MAX_BYTES) throw new Error('Sound pack exceeds bundle limits.');
      yield JSON.stringify({ path: name, sha256: digest(data), data: data.toString('base64') }) + '\n';
    }
  }
  await mkdir(path.dirname(bundleFile), { recursive: true });
  const temporary = `${bundleFile}.${randomUUID()}.tmp`;
  try {
    await pipeline(Readable.from(records()), createGzip({ level: 6 }), createWriteStream(temporary, { flags: 'wx' }));
    await rename(temporary, bundleFile);
  } finally { await rm(temporary, { force: true }); }
  const sha256 = await hashFile(bundleFile);
  const report = {
    format: 'veel-sounds-v1', clips: pack.clips.length, files: files.length,
    bytes: (await stat(bundleFile)).size, sha256,
    rights: { unverified: pack.clips.filter((c) => !c.rights || c.rights === 'unverified-source').length },
  };
  await writeFile(`${bundleFile}.sha256`, `${sha256}  ${path.basename(bundleFile)}\n`);
  await writeFile(`${bundleFile}.report.json`, JSON.stringify(report, null, 2));
  return report;
}

/** Verify before extracting; never replace an existing library or allow executable files. */
export async function restoreBundle(bundleFile: string, expectedSha256: string, outputRoot: string) {
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256) || await hashFile(bundleFile) !== expectedSha256.toLowerCase())
    throw new Error('Sound bundle SHA-256 mismatch.');
  const target = path.join(outputRoot, 'tamil-meme');
  if (await stat(target).then(() => true, () => false)) throw new Error('Sound pack already exists. Restore into a clean output directory.');
  await mkdir(outputRoot, { recursive: true });
  const staging = path.join(outputRoot, `.sound-import-${randomUUID()}`);
  await mkdir(staging);
  let count = 0;
  let expectedCount = 0;
  let unpacked = 0;
  let pending = '';
  const names = new Set<string>();
  let pack: Pack | undefined;
  const gunzip = createGunzip();
  const input = createReadStream(bundleFile);
  input.on('error', (error) => gunzip.destroy(error));
  input.pipe(gunzip);
  try {
    for await (const chunk of gunzip) {
      pending += (chunk as Buffer).toString('utf8');
      let newline: number;
      while ((newline = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
        if (line.length > MAX_FILE * 1.4) throw new Error('Oversized bundle record.');
        const record = JSON.parse(line) as { format?: string; files?: number; path?: string; sha256?: string; data?: string };
        if (!expectedCount) {
          if (record.format !== 'veel-sounds-v1' || !Number.isInteger(record.files) || record.files! < 3 || record.files! > 4001) throw new Error('Invalid bundle header.');
          expectedCount = record.files!; continue;
        }
        if (!record.path || !validPath.test(record.path) || names.has(record.path) || typeof record.data !== 'string' || ++count > expectedCount)
          throw new Error('Invalid, duplicate or unexpected bundle file.');
        const data = Buffer.from(record.data, 'base64');
        unpacked += data.length;
        if (data.length > MAX_FILE || unpacked > MAX_BYTES || digest(data) !== record.sha256) throw new Error('Invalid bundle file content.');
        if (record.path === 'pack.json') pack = parsePack(data);
        if (!pack || !filesFor(pack).includes(record.path)) throw new Error('Bundle file is not referenced by its manifest.');
        const destination = path.join(staging, record.path);
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, data, { flag: 'wx' });
        names.add(record.path);
      }
      if (pending.length > MAX_FILE * 1.4) throw new Error('Oversized bundle record.');
    }
    if (pending || !pack || count !== expectedCount || filesFor(pack).some((name) => !names.has(name))) throw new Error('Incomplete sound bundle.');
    await rename(staging, target);
    return { clips: pack.clips.length, files: count, bytes: unpacked };
  } finally {
    input.destroy(); gunzip.destroy();
    // staging is always a freshly generated child of outputRoot, never a supplied archive path.
    await rm(staging, { recursive: true, force: true });
  }
}

export async function downloadBundle(url: string, destination: string) {
  let current = new URL(url);
  for (let hop = 0; hop < 6; hop++) {
    if (current.protocol !== 'https:' || current.username || current.password) throw new Error('Use an HTTPS sound-bundle URL without embedded credentials.');
    const response = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(600_000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get('location');
      if (!location) throw new Error('Bundle redirect has no destination.');
      current = new URL(location, current); continue;
    }
    if (!response.ok || !response.body) throw new Error(`Sound download failed (HTTP ${response.status}).`);
    let bytes = 0;
    const limiter = new Transform({ transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      callback(bytes > MAX_BYTES ? new Error('Sound download exceeds 512 MiB.') : null, chunk);
    } });
    await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream<Uint8Array>), limiter, createWriteStream(destination, { flags: 'wx' }));
    return;
  }
  throw new Error('Too many sound-bundle redirects.');
}

export async function installWorklet(outputRoot: string, projectRoot: string) {
  await copyFile(path.join(projectRoot, 'apps/veel-veel/public/audio-capture-worklet.js'), path.join(outputRoot, 'audio-capture-worklet.js'));
}
