import { describe, expect, it, vi } from 'vitest';
import { loadSnapshot, type Transport } from './client';
import { defaultConfig } from './config';
import { fields } from './metrics';

const vector = {
  status: 'success',
  data: {
    resultType: 'vector',
    result: [{ metric: { __name__: fields.utilization, UUID: 'GPU-a' }, value: [100, '25'] }],
  },
};
const matrix = { status: 'success', data: { resultType: 'matrix', result: [] } };
describe('Prometheus queries', () => {
  it('passes the selected cluster and cancellation signal and bounds range resolution', async () => {
    const transport = vi
      .fn<Transport>()
      .mockImplementation(async (url) => (url.includes('query_range') ? matrix : vector));
    const signal = new AbortController().signal;
    const data = await loadSnapshot(transport, defaultConfig, 'production', 24, signal, 172800000);
    expect(data.devices[0].metrics.utilization).toBe(25);
    expect(data.step).toBe(360);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[0][1]).toMatchObject({
      cluster: 'production',
      signal,
      autoLogoutOnAuthError: false,
    });
    const range = new URL(transport.mock.calls[1][0], 'http://test');
    expect(range.searchParams.get('limit')).toBe('1000');
    expect(Number(range.searchParams.get('end')) - Number(range.searchParams.get('start'))).toBe(
      86400
    );
  });
  it('keeps current readings if history fails, with a visible warning', async () => {
    const transport: Transport = async (url) => {
      if (url.includes('query_range')) throw new Error('timeout');
      return vector;
    };
    const data = await loadSnapshot(transport, defaultConfig, 'a', 1, new AbortController().signal);
    expect(data.devices).toHaveLength(1);
    expect(data.warnings).toContain('History unavailable: timeout');
  });
  it('rejects API errors and malformed data instead of displaying zero', async () => {
    for (const bad of [
      { status: 'error', error: 'bad query' },
      {
        status: 'success',
        data: { resultType: 'vector', result: [{ metric: {}, value: ['oops', '1'] }] },
      },
    ]) {
      await expect(
        loadSnapshot(async () => bad, defaultConfig, 'a', 1, new AbortController().signal)
      ).rejects.toThrow();
    }
  });
  it('does not send requests with an invalid configuration', async () => {
    const request = vi.fn<Transport>();
    await expect(
      loadSnapshot(
        request,
        { ...defaultConfig, service: '../secrets' },
        'a',
        1,
        new AbortController().signal
      )
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
