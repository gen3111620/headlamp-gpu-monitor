import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { load } from 'js-yaml';
import { prepareCatalog } from './catalog.mjs';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'gpu-catalog-'));
  for (const name of ['artifacts', 'catalog', 'docs']) await mkdir(join(root, name));
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'headlamp-gpu-monitor',
      version: '0.1.0',
      description: 'GPU telemetry: NVIDIA',
      license: 'Apache-2.0',
    })
  );
  const archive = Buffer.from('release archive fixture');
  await writeFile(join(root, 'artifacts/headlamp-gpu-monitor-0.1.0.tar.gz'), archive);
  await writeFile(
    join(root, 'catalog/artifacthub-repo.yml'),
    'owners:\n  - name: Test Publisher\n    email: publisher@example.com\n'
  );
  await writeFile(join(root, 'docs/CATALOG.md'), '# GPU Monitor\n');
  return { root, archive };
}

test('prepares valid YAML with the exact release checksum and Desktop compatibility', async () => {
  const { root, archive } = await fixture();
  try {
    const { directory } = await prepareCatalog({ root, repository: 'publisher/gpu-monitor' });
    assert.equal(directory, join(root, 'artifacts/catalog/headlamp-gpu-monitor/0.1.0'));
    const metadata = load(await readFile(join(directory, 'artifacthub-pkg.yml'), 'utf8'));
    assert.equal(metadata.description, 'GPU telemetry: NVIDIA');
    assert.equal(
      metadata.annotations['headlamp/plugin/archive-checksum'],
      `sha256:${createHash('sha256').update(archive).digest('hex')}`
    );
    assert.equal(
      metadata.annotations['headlamp/plugin/archive-url'],
      'https://github.com/publisher/gpu-monitor/releases/download/v0.1.0/headlamp-gpu-monitor-0.1.0.tar.gz'
    );
    assert.ok(metadata.annotations['headlamp/plugin/distro-compat'].split(',').includes('app'));
    assert.equal(metadata.annotations['headlamp/plugin/version-compat'], '=0.45.0');
    assert.equal((await readFile(join(directory, 'README.md'), 'utf8')).trim(), '# GPU Monitor');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('writes the tracked catalog only explicitly and preserves the version creation timestamp', async () => {
  const { root } = await fixture();
  try {
    const first = await prepareCatalog({ root, repository: 'publisher/gpu-monitor', write: true });
    assert.equal(first.directory, join(root, 'catalog/headlamp-gpu-monitor/0.1.0'));
    const second = await prepareCatalog({ root, repository: 'publisher/gpu-monitor', write: true });
    assert.equal(first.metadata.createdAt, second.metadata.createdAt);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects repository URLs and requires publisher ownership metadata', async () => {
  const { root } = await fixture();
  try {
    await assert.rejects(
      prepareCatalog({ root, repository: 'https://github.com/publisher/repo' }),
      /ACCOUNT\/REPOSITORY/
    );
    await writeFile(join(root, 'catalog/artifacthub-repo.yml'), 'owners: []\n');
    await assert.rejects(prepareCatalog({ root, repository: 'publisher/repo' }), /public owner/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
