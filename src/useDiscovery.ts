import { useEffect, useState } from 'react';
import type { Transport } from './client';
import { discoverSources, type DiscoveryResult } from './discovery';

export interface DiscoveryState extends DiscoveryResult {
  loading: boolean;
}

export function useDiscovery(
  transport: Transport,
  cluster: string,
  enabled: boolean,
  refresh: number
): DiscoveryState {
  const key = JSON.stringify([cluster, enabled, refresh]);
  const [state, setState] = useState<DiscoveryState & { key: string }>({
    key,
    sources: [],
    loading: enabled,
  });
  useEffect(() => {
    if (!enabled || !cluster) return;
    const controller = new AbortController();
    let active = true;
    setState({ key, sources: [], loading: true });
    void discoverSources(transport, cluster, controller.signal)
      .then((result) => {
        if (active) setState({ ...result, key, loading: false });
      })
      .catch((error: unknown) => {
        if (active)
          setState({
            key,
            sources: [],
            loading: false,
            message: error instanceof Error ? error.message : 'Prometheus discovery failed.',
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
    // The key cancels discovery when cluster, enabled state or retry changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, transport]);
  return state.key === key ? state : { loading: enabled && Boolean(cluster), sources: [] };
}
