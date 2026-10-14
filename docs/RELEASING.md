# Release preparation

Development is local until the owner approves publication. Use the owner's **personal GitHub account**, not an organization. Do not copy Kubernetes credentials, local environment files, dependency directories, or synthetic cluster configuration into a release.

## Local preparation

1. Update `package.json` and its lockfile version together.
2. Run `npm ci`, `npm run validate`, `npm run test:promql`, and `npm run test:browser` with `HEADLAMP_TEST_URL` as described in [VALIDATION.md](VALIDATION.md).
3. Load the resulting plugin in the supported Headlamp version and test against a real DCGM/Prometheus installation. Check workload labels, units, RBAC denial and a stopped exporter. Record hardware and exporter versions before claiming hardware compatibility.
4. Run `npm run package` and `npm run checksums`. Inspect the archive contents.
5. Generate Artifact Hub metadata using the chosen personal account/repository:

   ```sh
   node scripts/catalog.mjs PERSONAL_ACCOUNT/headlamp-gpu-monitor
   ```

   This writes only local files under `artifacts/catalog/`, derives the checksum from the actual tarball, and sets the download URL to the future GitHub Release. It performs no network calls or publication. The current compatibility annotation is deliberately limited to Headlamp 0.45.0; widen it after testing other versions/flavors.

## After approval

Create a public repository under the confirmed personal account, add that repository as the remote, and push the reviewed source. This step does not require forking Headlamp. Upload the tarball and `SHA256SUMS` to a `vVERSION` release.

Copy the generated version directory into a tracked `catalog/` directory. Add repository ownership metadata (`artifacthub-repo.yml`) using the owner's chosen public name/email, and register the repository path as a **Headlamp plugin** repository in Artifact Hub. Do not invent identity information.

New community plugins may be hidden by the Plugin Catalog's "Only official plugins" setting. Document that users may need to enable community listings. Artifact Hub indexing does not make a plugin official or establish trust.

Automated CI/release workflows can be added after review; this initial local project creates no workflows and publishes nothing automatically.

References: [Artifact Hub repository layout](https://artifacthub.io/docs/topics/repositories/headlamp-plugins/), [Headlamp annotations](https://artifacthub.io/docs/topics/annotations/headlamp/).
