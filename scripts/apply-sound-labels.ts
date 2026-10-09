import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type CatalogClip = { clip_id: string; category?: string; [key: string]: unknown };
type Votes = Record<string, Record<string, number>>;
const [votesPath, ...catalogArgs] = process.argv.slice(2);
if (!votesPath) throw new Error('Usage: pnpm labels:apply <votes.json> [catalog.jsonl]');
const votes = JSON.parse(await readFile(path.resolve(votesPath), 'utf8')) as Votes;
const catalogPaths = catalogArgs.length ? catalogArgs : ['data/catalog/clips.jsonl', 'data/catalog/extra-clips.jsonl'];
let appliedTotal = 0;
for (const catalogArg of catalogPaths) {
  const sourcePath = path.resolve(catalogArg);
  const outputPath = sourcePath.replace(/\.jsonl$/i, '.categorized.jsonl');
  try { await access(sourcePath); }
  catch { if (!catalogArgs.length) continue; throw new Error(`Catalog not found: ${sourcePath}`); }
  const catalog = (await readFile(sourcePath, 'utf8')).split(/\r?\n/).filter(Boolean)
    .map((line) => JSON.parse(line) as CatalogClip);
  let applied = 0;
  for (const clip of catalog) {
    const totals = votes[clip.clip_id];
    if (!totals) continue;
    const winner = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
    const totalVotes = Object.values(totals).reduce((sum, count) => sum + count, 0);
    if (!winner || winner[1] < 3 || winner[1] / totalVotes < 0.6) continue;
    clip.category = winner[0];
    applied += 1;
  }
  appliedTotal += applied;
  await writeFile(outputPath, `${catalog.map((clip) => JSON.stringify(clip)).join('\n')}\n`, 'utf8');
  console.log(`Applied consensus labels to ${applied}/${catalog.length} sounds. Wrote ${outputPath}`);
}
if (!appliedTotal) console.log('No labels met the three-vote / 60% consensus threshold yet.');
