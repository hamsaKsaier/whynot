export type HostnameMode = 'admin' | 'superadmin';

const SUPERADMIN_HOSTNAMES = [
  'superadmin.whynot.skrum.io',
  'superadmin.localhost',
];

export function getHostnameMode(): HostnameMode {
  const hostname = window.location.hostname;
  if (SUPERADMIN_HOSTNAMES.includes(hostname)) {
    return 'superadmin';
  }
  return 'admin';
}

export function isSuperadminHostname(): boolean {
  return getHostnameMode() === 'superadmin';
}

export function getAdminUrl(): string {
  const proto = window.location.protocol;
  const port = window.location.port ? `:${window.location.port}` : '';
  return `${proto}//admin.whynot.skrum.io${port}`;
}
