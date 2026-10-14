import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dump, load } from 'js-yaml';

export async function prepareCatalog({
  repository,
  root = fileURLToPath(new URL('../', import.meta.url)),
  write = false,
}) {
  if (!repository || !/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9._-]+$/.test(repository))
    throw new Error('Pass a GitHub ACCOUNT/REPOSITORY without a URL or branch.');
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const filename = `${pkg.name}-${pkg.version}.tar.gz`;
  const hash = createHash('sha256')
    .update(await readFile(resolve(root, 'artifacts', filename)))
    .digest('hex');
  const ownership = load(await readFile(resolve(root, 'catalog/artifacthub-repo.yml'), 'utf8'));
  if (!ownership?.owners?.length || ownership.owners.some((owner) => !owner.name || !owner.email))
    throw new Error(
      'Set the public owner name and Artifact Hub email in catalog/artifacthub-repo.yml.'
    );
  const directory = resolve(root, write ? 'catalog' : 'artifacts/catalog', pkg.name, pkg.version);
  const output = resolve(directory, 'artifacthub-pkg.yml');
  let createdAt = new Date().toISOString();
  try {
    const previous = load(await readFile(output, 'utf8'));
    if (previous?.createdAt) createdAt = new Date(previous.createdAt).toISOString();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const home = `https://github.com/${repository}`;
  const metadata = {
    version: pkg.version,
    name: pkg.name,
    displayName: 'GPU Monitor',
    createdAt,
    description: pkg.description,
    license: pkg.license,
    category: 'monitoring-logging',
    homeURL: home,
    keywords: ['gpu', 'nvidia', 'dcgm', 'prometheus', 'kubernetes'],
    maintainers: ownership.owners,
    links: [
      { name: 'Source', url: home },
      { name: 'Releases', url: `${home}/releases` },
    ],
    install:
      'In Headlamp Desktop 0.45.0, open Plugin Catalog and disable "Only official plugins" ' +
      'if this community plugin is hidden. Install GPU Monitor and reload the UI. ' +
      'The selected Kubernetes cluster needs DCGM Exporter and a Prometheus Service scraping it.',
    annotations: {
      'headlamp/plugin/archive-url': `${home}/releases/download/v${pkg.version}/${filename}`,
      'headlamp/plugin/archive-checksum': `sha256:${hash}`,
      'headlamp/plugin/version-compat': '=0.45.0',
      'headlamp/plugin/distro-compat': 'app,in-cluster,web,linux',
    },
  };
  await mkdir(directory, { recursive: true });
  await writeFile(output, dump(metadata, { lineWidth: 100, noRefs: true }));
  await writeFile(
    resolve(directory, 'README.md'),
    await readFile(resolve(root, 'docs/CATALOG.md'))
  );
  return { directory, metadata };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [repository, ...flags] = process.argv.slice(2);
  try {
    if (flags.some((flag) => flag !== '--write'))
      throw new Error('Usage: npm run catalog -- ACCOUNT/REPOSITORY [--write]');
    const { directory } = await prepareCatalog({ repository, write: flags.includes('--write') });
    console.log(`Prepared catalog metadata in ${directory}. Nothing was published.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
