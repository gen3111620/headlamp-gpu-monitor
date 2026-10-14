import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { defaultConfig } from './config';
import { sourceLabel } from './discovery';
import { Settings } from './Settings';

afterEach(cleanup);

it('requires a source selection and saves detected connection details without manual fields', () => {
  const source = {
    automatic: false,
    devices: 4,
    config: { ...defaultConfig, namespace: 'lens-metrics', service: 'prometheus', port: '80' },
  };
  const onSave = vi.fn();
  render(
    <Settings
      initial={defaultConfig}
      configured={false}
      cluster="main"
      discovery={{ loading: false, sources: [source] }}
      onSave={onSave}
      onClose={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save connection' }));
  expect(screen.getByText(/Select a GPU metrics source or enter a manual connection/)).toBeTruthy();
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'GPU metrics source' }));
  fireEvent.click(screen.getByRole('option', { name: sourceLabel(source) }));
  fireEvent.click(screen.getByRole('button', { name: 'Save connection' }));
  expect(onSave).toHaveBeenCalledWith(source.config);
});

it('retains manual connection validation when discovery is unavailable', () => {
  const onSave = vi.fn();
  render(
    <Settings
      initial={defaultConfig}
      configured={false}
      cluster="main"
      discovery={{ loading: false, sources: [], message: 'No Prometheus Service found.' }}
      onSave={onSave}
      onClose={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Advanced settings' }));
  fireEvent.change(screen.getByLabelText('Prometheus subpath (optional)'), {
    target: { value: '/../secrets' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save connection' }));
  expect(screen.getByText(/optional path must contain/)).toBeTruthy();
  expect(onSave).not.toHaveBeenCalled();
});
