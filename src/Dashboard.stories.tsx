import { fixtureSnapshot } from '../tests/fixtures';
import { Dashboard } from './Dashboard';

export default { title: 'GPU Monitor/Dashboard', component: Dashboard };
const base = {
  cluster: 'demo-cluster',
  configured: true,
  hours: 1,
  onHours: () => {},
  onRefresh: () => {},
  onConfigure: () => {},
};
export const Connected = () => (
  <Dashboard {...base} state={{ loading: false, data: fixtureSnapshot() }} />
);
export const Loading = () => <Dashboard {...base} state={{ loading: true }} />;
export const AccessDenied = () => (
  <Dashboard
    {...base}
    state={{
      loading: false,
      error: 'Access denied. Check permission to read the Prometheus Service proxy.',
    }}
  />
);
export const Empty = () => (
  <Dashboard
    {...base}
    state={{ loading: false, data: { ...fixtureSnapshot(), devices: [], history: [] } }}
  />
);
export const Stale = () => (
  <Dashboard
    {...base}
    state={{ loading: false, data: fixtureSnapshot(), error: 'Prometheus connection timed out.' }}
  />
);
export const NotConfigured = () => (
  <Dashboard {...base} configured={false} state={{ loading: false }} />
);
