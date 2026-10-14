import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Transport } from './client';
import { defaultConfig } from './config';
import { useMetrics } from './useMetrics';

afterEach(cleanup);
const empty = (url: string) => ({
  status: 'success',
  data: { resultType: url.includes('query_range') ? 'matrix' : 'vector', result: [] },
});
describe('query lifecycle', () => {
  it('cancels old-cluster requests and ignores their late responses', async () => {
    const finish: (() => void)[] = [];
    const signals: AbortSignal[] = [];
    const transport: Transport = (url, { cluster, signal }) => {
      if (cluster === 'old') {
        signals.push(signal);
        return new Promise((resolve) => finish.push(() => resolve(empty(url))));
      }
      return Promise.resolve(empty(url));
    };
    const { result, rerender } = renderHook(
      ({ cluster }) => useMetrics(transport, defaultConfig, cluster, 1, 0),
      { initialProps: { cluster: 'old' } }
    );
    rerender({ cluster: 'new' });
    await waitFor(() => expect(result.current.data).toBeDefined());
    const current = result.current.data;
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    await act(async () => finish.forEach((resolve) => resolve()));
    expect(result.current.data).toBe(current);
  });
  it('does not query an unconfigured cluster', () => {
    const transport = vi.fn<Transport>();
    renderHook(() => useMetrics(transport, undefined, 'unconfigured', 1, 0));
    expect(transport).not.toHaveBeenCalled();
  });
});
