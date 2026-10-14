import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const repository = process.argv[2];
if (!repository || !/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9._-]+$/.test(repository)) {
  console.error('Usage: node scripts/catalog.mjs PERSONAL_ACCOUNT/REPOSITORY');
  process.exit(1);
}
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const filename = `${pkg.name}-${pkg.version}.tar.gz`;
const bytes = await readFile(new URL(`../artifacts/${filename}`, import.meta.url));
const hash = createHash('sha256').update(bytes).digest('hex');
const directory = new URL(`../artifacts/catalog/${pkg.name}/${pkg.version}/`, import.meta.url);
await mkdir(directory, { recursive: true });
const yaml = `version: ${pkg.version}
name: ${pkg.name}
displayName: GPU Monitor
description: ${pkg.description}
license: Apache-2.0
homeURL: https://github.com/${repository}
createdAt: ${JSON.stringify(new Date().toISOString())}
keywords:
  - gpu
  - nvidia
  - prometheus
links:
  - name: Source
    url: https://github.com/${repository}
annotations:
  headlamp/plugin/archive-url: https://github.com/${repository}/releases/download/v${
  pkg.version
}/${filename}
  headlamp/plugin/archive-checksum: sha256:${hash}
  headlamp/plugin/version-compat: "=0.45.0"
  headlamp/plugin/distro-compat: "in-cluster,web"
`;
await writeFile(new URL('artifacthub-pkg.yml', directory), yaml);
await writeFile(
  new URL('README.md', directory),
  await readFile(new URL('../README.md', import.meta.url))
);
console.log(
  `Prepared local catalog metadata in artifacts/catalog/${pkg.name}/${pkg.version}/. Nothing was published.`
);
