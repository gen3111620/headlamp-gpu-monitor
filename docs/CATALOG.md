# GPU Monitor for Headlamp

NVIDIA GPU telemetry from an existing DCGM Exporter and Prometheus installation.

GPU Monitor shows device utilization, framebuffer memory, temperature, power draw and 1/6/24-hour history. It also integrates with Node details and Pods requesting NVIDIA GPU resources. Only GPUs with recent telemetry appear; this is not a scheduler allocation or complete hardware inventory.

## Requirements

- Headlamp 0.45.0. Linux Desktop and in-cluster loading are validated; Windows and macOS Desktop have not been tested.
- NVIDIA GPUs with drivers and DCGM Exporter.
- A Prometheus Service scraping DCGM metrics more frequently than every two minutes.
- Kubernetes permission to access that Service through `services/proxy`.

Installing the plugin does not install drivers, DCGM Exporter or Prometheus.

## Install in Desktop

1. Open Plugin Catalog. Disable **Only official plugins** in its settings if this community plugin is hidden.
2. Search for **GPU Monitor**, check the source repository, and install it.
3. Reload the UI, select your Kubernetes cluster, and open **GPU Monitor**.

The plugin discovers common Prometheus Services and connects a unique source whose GPU node names match the selected cluster. If several sources match, select one in **Connection settings**. **Advanced settings** supports manual Service, subpath and cluster-label configuration.

Discovery needs permission to list Services and Nodes. A manual connection only needs access to the chosen Service proxy. Connection settings are stored per cluster in the local Headlamp profile and contain no separate backend credentials.

## Interpretation

Missing or unsupported values remain unavailable. Samples older than two minutes are excluded, and failed refreshes mark previous readings stale. MIG instances are separate from full GPUs. Pod labels describe device associations, not guaranteed per-Pod consumption on shared GPUs.

Documentation and source: [gen3111620/headlamp-gpu-monitor](https://github.com/gen3111620/headlamp-gpu-monitor).
