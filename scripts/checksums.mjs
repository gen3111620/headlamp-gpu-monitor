import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const filename = `${pkg.name}-${pkg.version}.tar.gz`;
const bytes = await readFile(new URL(`../artifacts/${filename}`, import.meta.url));
const hash = createHash('sha256').update(bytes).digest('hex');
await writeFile(new URL('../artifacts/SHA256SUMS', import.meta.url), `${hash}  ${filename}\n`);
console.log(`${hash}  ${filename}`);
