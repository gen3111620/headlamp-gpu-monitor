# Local validation record

Validated on October 13, 2026, with Node.js 22.23.3, Plugin SDK 0.14.0, Headlamp 0.45.0, Chrome and Prometheus promtool 3.5.0. This records software integration with controlled test data. No live Kubernetes cluster or GPU hardware was used.

| Check                                                    | Command                                                        | Result                |
| -------------------------------------------------------- | -------------------------------------------------------------- | --------------------- |
| Formatting, lint, types, unit tests and production build | `npm run validate`                                             | Passed; 14 unit tests |
| Query semantics in the actual Prometheus engine          | `npm run test:promql`                                          | Passed; 1 test        |
| Standalone preview and real Headlamp host                | `HEADLAMP_TEST_URL=http://127.0.0.1:4467 npm run test:browser` | Passed; 3 tests       |
| Component stories                                        | `npm run storybook-build`                                      | Passed                |

Unit tests cover duplicate scrape targets, MIG separation, missing values, valid zeroes, exported workload labels, Pod namespace isolation, historical gaps, connection validation, API errors, bounded queries, request cancellation and cluster switching. The promtool test verifies the production PromQL's cluster filter and source-sample freshness rule.

Browser tests load the compiled plugin in the official Headlamp image. They verify connection settings and persistence, the Kubernetes Service proxy URL, history rendering, Node and Pod detail filtering, access denial, and switching to a cluster with no connection settings. Separate preview checks cover filters, light/dark themes, a 390px mobile viewport, and loading/empty/denied/stale states. Kubernetes and Prometheus API responses are intercepted by Playwright; they are not evidence of a live cluster connection.

Screenshots are in [screenshots/](screenshots/), including [the Headlamp integration](screenshots/headlamp-integration.png), [light theme](screenshots/preview-light.png), [dark theme](screenshots/preview-dark.png), and [mobile layout](screenshots/preview-mobile.png). All show synthetic data.

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

Desktop loading and direct hardware validation remain outstanding. The original Headlamp source tree was not changed. No remote repository, push, release, infrastructure change or CI workflow was created.
