import { useEffect, useState } from 'react';
import { errorMessage, loadSnapshot, type Snapshot, type Transport } from './client';
import type { ConnectionConfig } from './config';

export interface MetricsState {
  loading: boolean;
  data?: Snapshot;
  error?: string;
}

export function useMetrics(
  transport: Transport,
  config: ConnectionConfig | undefined,
  cluster: string,
  hours: number,
  refresh: number
): MetricsState {
  const key = JSON.stringify([config, cluster, hours, refresh]);
  const [state, setState] = useState<MetricsState & { key: string }>({ key, loading: true });
  useEffect(() => {
    if (!config || !cluster) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    setState({ key, loading: true });
    const update = async () => {
      controller = new AbortController();
      try {
        const data = await loadSnapshot(transport, config, cluster, hours, controller.signal);
        if (active) setState({ key, loading: false, data });
      } catch (error) {
        if (active)
          setState((previous) => ({
            key,
            loading: false,
            data: previous.key === key ? previous.data : undefined,
            error: errorMessage(error),
          }));
      } finally {
        if (active) timer = setTimeout(update, 30000);
      }
    };
    void update();
    return () => {
      active = false;
      clearTimeout(timer);
      controller?.abort();
    };
    // All query inputs are serialized into key; changes cancel the previous cluster's work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, transport]);
  return state.key === key ? state : { loading: true };
}
