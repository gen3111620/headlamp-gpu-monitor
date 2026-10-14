export interface ConnectionConfig {
  namespace: string;
  service: string;
  port: string;
  scheme: 'http' | 'https';
  path: string;
  clusterLabel: string;
  clusterValue: string;
}

export const defaultConfig: ConnectionConfig = {
  namespace: 'monitoring',
  service: 'prometheus-operated',
  port: '9090',
  scheme: 'http',
  path: '',
  clusterLabel: '',
  clusterValue: '',
};

export function validateConfig(config: ConnectionConfig): string | undefined {
  const dns = /^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/;
  if (!dns.test(config.namespace) || config.namespace.length > 63)
    return 'Enter a valid Kubernetes namespace.';
  if (!dns.test(config.service) || config.service.length > 63)
    return 'Enter a valid Kubernetes Service name.';
  if (!/^([1-9][0-9]{0,4}|[a-z][a-z0-9-]{0,14})$/.test(config.port))
    return 'Enter a Service port number or name.';
  if (/^\d+$/.test(config.port) && Number(config.port) > 65535)
    return 'The Service port must be between 1 and 65535.';
  if (!['http', 'https'].includes(config.scheme)) return 'Select HTTP or HTTPS.';
  if (config.path && !/^\/(?:[a-zA-Z0-9_-]+\/?)+$/.test(config.path))
    return 'The optional path must contain only slash-separated letters, numbers, underscores or hyphens.';
  if (Boolean(config.clusterLabel) !== Boolean(config.clusterValue))
    return 'Set both the cluster label and value, or leave both empty.';
  if (config.clusterLabel && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(config.clusterLabel))
    return 'Enter a valid Prometheus cluster label name.';
  if (config.clusterLabel.startsWith('__'))
    return 'Reserved Prometheus labels cannot scope a cluster.';
}

export function queryPath(config: ConnectionConfig, api: 'query' | 'query_range'): string {
  const error = validateConfig(config);
  if (error) throw new Error(error);
  const prefix = `/api/v1/namespaces/${config.namespace}/services/${config.scheme}:${config.service}:${config.port}/proxy`;
  return `${prefix}${config.path.replace(/\/$/, '')}/api/v1/${api}`;
}
