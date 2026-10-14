# Release preparation

Public source repository: `https://github.com/gen3111620/headlamp-gpu-monitor`, branch `main`. The owner performs push, GitHub Release creation and Artifact Hub registration. The preparation commands below do not publish anything.

## Local preparation

1. Update `package.json` and its lockfile version together.
2. Run `npm ci`, `npm run validate`, `npm run test:catalog`, `npm run test:promql`, and `npm run test:browser` with `HEADLAMP_TEST_URL` as described in [VALIDATION.md](VALIDATION.md).
3. Load the resulting plugin in the supported Headlamp version and test against a real DCGM/Prometheus installation. Check workload labels, units, RBAC denial and a stopped exporter. Record hardware and exporter versions before claiming hardware compatibility.
4. Run `npm run package` and `npm run checksums`. Inspect the archive contents.
5. Run the Linux Desktop check in [VALIDATION.md](VALIDATION.md#linux-desktop-validation) against that archive.
6. Generate Artifact Hub metadata from the archive that will be uploaded:

   ```sh
   npm run catalog -- gen3111620/headlamp-gpu-monitor --write
   ah lint --kind headlamp --path catalog
   ```

   This updates `catalog/headlamp-gpu-monitor/0.1.0/artifacthub-pkg.yml` and its README. Without `--write`, only ignored files under `artifacts/catalog/` are written. The checksum comes from the actual tarball; the download URL points to the future GitHub Release. Existing version creation timestamps are preserved. Compatibility is limited to Headlamp 0.45.0, including the tested Linux Desktop app; Windows and macOS have not been tested. Install the [Artifact Hub CLI](https://artifacthub.io/docs/topics/cli/) to run `ah lint`; the prepared catalog passed with CLI 1.23.0.

7. Check that `catalog/artifacthub-repo.yml` uses the public publisher identity. The prefilled name/email match the repository's existing commit author. The owner email must match the Artifact Hub login used to claim the repository; adjust it before pushing if that account uses another email.
8. Commit the source and `catalog/` files together. Do not commit credentials, local environment files, dependency directories or screenshots of private cluster data. The release archive and checksum file remain under ignored `artifacts/` for upload.

## GitHub Release

1. Push the reviewed commit to `main`.
2. In the repository's **Releases** page, create release **v0.1.0**, targeting that commit.
3. Upload these two assets, retaining their exact names:

   - `artifacts/headlamp-gpu-monitor-0.1.0.tar.gz`
   - `artifacts/SHA256SUMS`

4. Publish the release and confirm the archive URL in `artifacthub-pkg.yml` downloads successfully.

The final upload must be byte-for-byte identical to the archive used to generate the metadata. If you rebuild before publication, rerun checksums and catalog generation and commit the updated metadata. After publishing a version, use a new version for changes instead of replacing its archive.

## Artifact Hub Registration

In [Artifact Hub Control Panel](https://artifacthub.io/control-panel), add a repository using:

| Field          | Value                                                         |
| -------------- | ------------------------------------------------------------- |
| Kind           | **Headlamp plugin**                                           |
| Name           | An available repository name, for example `arvis-gpu-monitor` |
| Repository URL | `https://github.com/gen3111620/headlamp-gpu-monitor/catalog`  |
| Branch         | `main`                                                        |

Do not use `/tree/main/catalog` or the tarball download URL as the repository URL. Ownership metadata belongs at the catalog root; each package version is in its own folder. Wait for indexing and resolve any errors shown in the Control Panel. Optionally add the assigned repository ID to `catalog/artifacthub-repo.yml` to enable publisher verification.

New community plugins may be hidden by the Plugin Catalog's "Only official plugins" setting. Document that users may need to enable community listings. Artifact Hub indexing does not make a plugin official or establish trust.

After indexing, open Desktop Plugin Catalog, turn off **Only official plugins** if necessary, search for **GPU Monitor** and confirm the repository name before installing. Public Catalog search/download/install is a separate final check after publication; local Desktop loading is already validated.

There is no automatic release workflow in this repository.

References: [Artifact Hub repository layout](https://artifacthub.io/docs/topics/repositories/headlamp-plugins/), [Headlamp annotations](https://artifacthub.io/docs/topics/annotations/headlamp/).
