# Local validation record

Validated on October 13, 2026, with Node.js 22.23.3, Plugin SDK 0.14.0, Headlamp 0.45.0, Chrome and Prometheus promtool 3.5.0. This records software integration with controlled test data. No live Kubernetes cluster or GPU hardware was used.

| Check                                                    | Command                                                        | Result                |
| -------------------------------------------------------- | -------------------------------------------------------------- | --------------------- |
| Formatting, lint, types, unit tests and production build | `npm run validate`                                             | Passed; 14 unit tests |
| Query semantics in the actual Prometheus engine          | `npm run test:promql`                                          | Passed; 1 test        |
| Standalone preview and real Headlamp host                | `HEADLAMP_TEST_URL=http://127.0.0.1:4467 npm run test:browser` | Passed; 3 tests       |
| Component stories                                        | `npm run storybook-build`                                      | Passed                |

Unit tests cover duplicate scrape targets, MIG separation, missing values, valid zeroes, exported workload labels, Pod namespace isolation, historical gaps, connection validation, API errors, bounded queries, request cancellation and cluster switching. The promtool test verifies the production PromQL's cluster filter and source-sample freshness rule.

Discovery tests cover Service pagination and ports, current-cluster node matching, centralized cluster filters, ambiguous sources, restricted access, truncated responses, and cancellation during cluster switching. The PromQL fixture includes two metric names with identical GPU labels to prevent duplicate-labelset errors from `timestamp()`.

Browser tests load the compiled plugin in the official Headlamp image. They verify connection settings and persistence, the Kubernetes Service proxy URL, history rendering, Node and Pod detail filtering, access denial, and switching to a cluster with no connection settings. Separate preview checks cover filters, light/dark themes, a 390px mobile viewport, and loading/empty/denied/stale states. Kubernetes and Prometheus API responses are intercepted by Playwright; they are not evidence of a live cluster connection.

Screenshots are in [screenshots/](screenshots/), including [the Headlamp integration](screenshots/headlamp-integration.png), [light theme](screenshots/preview-light.png), [dark theme](screenshots/preview-dark.png), and [mobile layout](screenshots/preview-mobile.png). All show synthetic data.

## October 14, 2026 update

Revalidated with Node.js 22.23.3, npm 11.21.0, Plugin SDK 0.14.0, Headlamp 0.45.0, Playwright Chromium and promtool 3.5.0:

- Formatting, lint, TypeScript, production build and 27 unit tests passed. `npm run lint-fix` also passed.
- The actual Prometheus engine passed the multi-metric, cluster-filter, zero-value and stale-sample regression test, using `PROMTOOL_PATH` instead of Docker.
- All four browser tests passed, including automatic connection and persistence, selecting/manual editing of connections, Node/Pod sections, access denial, cluster switching and a 390px mobile viewport. The host-integration API responses in this suite remain synthetic.
- A separate live browser session, with no saved plugin settings and no mocked API responses, automatically found the existing Prometheus Service and displayed four Quadro RTX 5000 GPUs on two Kubernetes worker Nodes. Instant and historical requests had no HTTP failures, there were no page errors, and the desktop/mobile layouts were checked.

Current screenshots from the extra live check and the discovery dialog are local files under the ignored `artifacts/` directory. These observations confirm the live metrics connection; direct device-reading comparisons, exporter interruption, MIG/shared GPU behavior and Desktop compatibility still require separate checks. The plugin reuses the existing monitoring backend and does not create monitoring Services.

## Reproduce the host integration

Run from this repository with Docker and Chrome available. This starts a separate Headlamp bound to localhost, with no kubeconfig mounted. Choose an unused container name and port if these are already occupied.

```sh
npm ci
npm run validate
npm run test:promql
npm run storybook-build
npm run package
npm run checksums
mkdir -p artifacts/install
tar -xzf artifacts/headlamp-gpu-monitor-0.1.0.tar.gz -C artifacts/install
docker run -d --rm --name headlamp-gpu-monitor-local-review \
  -p 127.0.0.1:4467:4466 \
  -v "$PWD/artifacts/install:/headlamp/plugins:ro" \
  ghcr.io/headlamp-k8s/headlamp:v0.45.0
HEADLAMP_TEST_URL=http://127.0.0.1:4467 npm run test:browser
docker stop headlamp-gpu-monitor-local-review
```

Wait for Headlamp to respond at `http://127.0.0.1:4467` before running the browser checks. The SDK refuses to overwrite an existing archive; move the old archive aside if repackaging version 0.1.0. `npm run preview` remains a convenient independent UI preview without Docker.

## Before a public hardware compatibility claim

- Record Headlamp, Kubernetes, GPU model, driver, DCGM Exporter and Prometheus versions.
- Compare displayed GPU utilization, memory, temperature and power with the exporter and device readings under idle and active workloads.
- Check Node hostname mapping and workload namespace/Pod/container labels, including any `exported_*` relabeling.
- Stop an exporter and verify old series disappear after the two-minute freshness window; deny Service proxy access and verify the error state.
- Test MIG and shared-GPU modes separately before claiming them supported on a specific deployment.
- Verify access controls and cluster label scoping with the deployment's actual authentication and monitoring topology.

## Linux Desktop validation

On October 14, 2026, the official Linux x64 Headlamp Desktop **0.45.0** tarball was downloaded from the project's GitHub Release and verified against its published SHA256 (`53fad75ab54432c84f8ec319fa7e4040a2a6785667155e0124c6ce0f9690cfee`). Playwright launched the actual packaged Electron application under Xvfb with an isolated user profile.

The plugin archive was extracted into that profile's production `Headlamp/user-plugins` directory; Plugin Development Mode was not enabled. The test checked the shipped Plugin Catalog sidebar entry, GPU Monitor loading, automatic Prometheus discovery, all four live GPU rows across two worker Nodes, history rendering, local settings persistence and reload. No Kubernetes or Prometheus responses were mocked. There were no page errors or failed metrics requests. Screenshots remain in ignored `artifacts/desktop-catalog.png` and `artifacts/desktop-live-gpu.png`.

To reproduce on Linux with a display server, `tar`, a packaged Desktop 0.45.0 executable, a built plugin archive and a suitable kubeconfig:

```sh
HEADLAMP_DESKTOP_EXECUTABLE=/path/to/Headlamp-0.45.0-linux-x64/headlamp \
HEADLAMP_DESKTOP_KUBECONFIG=/path/to/kubeconfig \
HEADLAMP_DESKTOP_CONTEXT=your-context \
HEADLAMP_DESKTOP_EXPECT_GPU_COUNT=4 \
npm run test:desktop
```

Use `xvfb-run -a npm run test:desktop` in place of the last line on a server without a display. The expected GPU count is optional. The test uses backend port 4469 and a temporary profile, which is removed on success or failure. Traces are disabled to avoid recording authenticated cluster traffic. Never place the kubeconfig in this repository.

All three Catalog preparation tests passed. They verify YAML serialization, the archive URL and exact checksum, Desktop compatibility metadata, explicit writes to the tracked catalog and stable creation timestamps. Run `npm run test:catalog`; these checks are also included in `npm run validate`. The generated catalog passed the official Artifact Hub CLI 1.23.0 command `ah lint --kind headlamp --path catalog`, with one package found and zero package errors.

This verifies manual installation of the release archive and actual Desktop runtime behavior. It does not verify public Catalog indexing or installation from Artifact Hub, which require the owner to publish the release and register the repository. Windows/macOS Desktop, direct device-reading comparisons, exporter interruption and MIG/shared-GPU hardware remain untested. No release, push or Artifact Hub registration was performed during this check.
