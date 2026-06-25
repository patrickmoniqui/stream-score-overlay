const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function normalizeApiBaseUrl(value: string | undefined): string | null {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  return normalized.replace(/\/$/, '');
}

function shouldUseCloudBackendOverride(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (!LOCAL_HOSTNAMES.has(window.location.hostname)) {
    return false;
  }

  const backendParam = new URLSearchParams(window.location.search).get('backend');
  return backendParam?.trim().toLowerCase() === 'cloud';
}

export function getApiBaseUrl(): string {
  const configured = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

  if (configured) {
    return configured;
  }

  if (shouldUseCloudBackendOverride()) {
    const cloudOverride = normalizeApiBaseUrl(import.meta.env.VITE_CLOUD_API_BASE_URL);

    if (cloudOverride) {
      return cloudOverride;
    }
  }

  return '/api';
}
