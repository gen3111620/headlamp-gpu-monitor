import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Transport } from './client';
import { useDiscovery } from './useDiscovery';

afterEach(cleanup);

it('cancels discovery and ignores results from the previous cluster', async () => {
  const signals: AbortSignal[] = [];
  const finish: (() => void)[] = [];
  const transport: Transport = (url, options) => {
    if (options.cluster === 'old') {
      signals.push(options.signal);
      return new Promise((resolve) => finish.push(() => resolve({ items: [] })));
    }
    return Promise.resolve({ items: [] });
  };
  const { result, rerender } = renderHook(
    ({ cluster }) => useDiscovery(transport, cluster, true, 0),
    { initialProps: { cluster: 'old' } }
  );
  rerender({ cluster: 'new' });
  await waitFor(() => expect(result.current.loading).toBe(false));
  const current = result.current;
  expect(signals.every((signal) => signal.aborted)).toBe(true);
  await act(async () => finish.forEach((resolve) => resolve()));
  expect(result.current).toBe(current);
});

it('respects an existing manual connection until discovery is requested', () => {
  const transport = vi.fn<Transport>();
  renderHook(() => useDiscovery(transport, 'main', false, 0));
  expect(transport).not.toHaveBeenCalled();
});
