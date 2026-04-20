import { getApiBaseUrl } from './config';
import type { ScheduleResponse, ScoreResponse } from './types';

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function fetchScheduleNow(signal?: AbortSignal): Promise<ScheduleResponse> {
  return fetchJson<ScheduleResponse>('/schedule/now', signal);
}

export function fetchScoreNow(signal?: AbortSignal): Promise<ScoreResponse> {
  return fetchJson<ScoreResponse>('/score/now', signal);
}

