import { ConfigStore } from '@kinvolk/headlamp-plugin/lib';
import { request } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { getCluster } from '@kinvolk/headlamp-plugin/lib/Utils';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { type ConnectionConfig, defaultConfig } from './config';
import { Dashboard } from './Dashboard';
import type { Scope } from './metrics';
import { Settings } from './Settings';
import { useMetrics } from './useMetrics';

const store = new ConfigStore<Record<string, ConnectionConfig>>('headlamp-gpu-monitor');
const useConfig = store.useConfig();

export function Monitor({ cluster: resourceCluster, scope }: { cluster?: string; scope?: Scope }) {
  useLocation();
  const cluster = resourceCluster || getCluster() || '';
  // Remount controls as well as queries when the cluster or resource changes.
  return <ClusterMonitor key={JSON.stringify([cluster, scope])} cluster={cluster} scope={scope} />;
}

function ClusterMonitor({ cluster, scope }: { cluster: string; scope?: Scope }) {
  const config = useConfig()?.[cluster];
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hours, setHours] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const state = useMetrics(request, config, cluster, hours, refresh);
  return (
    <>
      <Dashboard
        cluster={cluster}
        state={state}
        configured={Boolean(config)}
        scope={scope}
        hours={hours}
        onHours={setHours}
        onRefresh={() => setRefresh((value) => value + 1)}
        onConfigure={() => setSettingsOpen(true)}
      />
      {settingsOpen && (
        <Settings
          cluster={cluster}
          initial={config || defaultConfig}
          onClose={() => setSettingsOpen(false)}
          onSave={(config) => {
            store.update({ [cluster]: config });
            setSettingsOpen(false);
          }}
        />
      )}
    </>
  );
}
