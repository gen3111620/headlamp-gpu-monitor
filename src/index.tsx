import {
  registerDetailsViewSection,
  registerRoute,
  registerSidebarEntry,
} from '@kinvolk/headlamp-plugin/lib';
import { Monitor } from './Monitor';

registerSidebarEntry({
  parent: null,
  name: 'gpu-monitor',
  label: 'GPU Monitor',
  url: '/gpu-monitor',
  icon: 'mdi:expansion-card',
});
registerRoute({
  path: '/gpu-monitor',
  sidebar: 'gpu-monitor',
  name: 'gpu-monitor',
  exact: true,
  component: () => <Monitor />,
});
registerDetailsViewSection(({ resource }) => {
  if (resource?.kind === 'Node')
    return <Monitor cluster={resource.cluster} scope={{ node: resource.getName() }} />;
  if (resource?.kind === 'Pod') {
    const containers = resource.jsonData.spec?.containers || [];
    const requestsGpu = containers.some(
      (container: {
        resources?: { requests?: Record<string, unknown>; limits?: Record<string, unknown> };
      }) =>
        [
          ...Object.keys(container.resources?.requests || {}),
          ...Object.keys(container.resources?.limits || {}),
        ].some((key) => key === 'nvidia.com/gpu' || key.startsWith('nvidia.com/mig-'))
    );
    if (requestsGpu)
      return (
        <Monitor
          cluster={resource.cluster}
          scope={{ namespace: resource.getNamespace(), pod: resource.getName() }}
        />
      );
  }
  return null;
});
