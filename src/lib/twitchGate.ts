import { getApiBaseUrl } from './config';

export interface TwitchGateStatus {
  enabled: boolean;
  authenticated: boolean;
  entitled: boolean;
  login: string | null;
  userId: string | null;
  overlayToken: string | null;
}

export interface TwitchGateVerification {
  enabled: boolean;
  entitled: boolean;
  valid: boolean;
  userId: string | null;
}

function getAuthBaseUrl(): string {
  const configured = import.meta.env.VITE_TWITCH_AUTH_BASE?.trim();

  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const apiBaseUrl = getApiBaseUrl();

  return apiBaseUrl.endsWith('/api') ? apiBaseUrl.slice(0, -4) : apiBaseUrl;
}

export function buildTwitchLoginUrl(returnTo = window.location.href): string {
  const url = new URL('/auth/twitch/login', getAuthBaseUrl());
  url.searchParams.set('return_to', returnTo);
  return url.toString();
}

export function buildTwitchLogoutUrl(returnTo = window.location.href): string {
  const url = new URL('/auth/twitch/logout', getAuthBaseUrl());
  url.searchParams.set('return_to', returnTo);
  return url.toString();
}

export async function fetchTwitchGateStatus(
  signal?: AbortSignal,
): Promise<TwitchGateStatus> {
  const url = new URL('/auth/twitch/status', getAuthBaseUrl());
  const response = await fetch(url, {
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Twitch gate status failed with ${response.status}`);
  }

  return response.json() as Promise<TwitchGateStatus>;
}

export async function verifyTwitchGateToken(
  token: string,
  signal?: AbortSignal,
): Promise<TwitchGateVerification> {
  const url = new URL('/auth/twitch/verify', getAuthBaseUrl());
  url.searchParams.set('token', token);

  const response = await fetch(url, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Twitch gate verification failed with ${response.status}`);
  }

  return response.json() as Promise<TwitchGateVerification>;
}
