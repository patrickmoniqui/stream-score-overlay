import { isOverlayStyle } from './overlayStyles';
import type { OverlayConfig } from './types';

export const DEFAULT_CONFIG: OverlayConfig = {
  mode: 'auto',
  style: 'broadcast',
  layout: 'compact',
  teams: [],
  playoffsOnly: true,
  showClock: true,
  showCredit: true,
};

function parseBoolean(value: string | null, fallback: boolean): boolean {
  if (value === null) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function normalizeTeams(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim().toUpperCase())
        .filter((value) => value && value !== 'AUTO'),
    ),
  );
}

export function parseConfig(search: string): OverlayConfig {
  const params = new URLSearchParams(search);
  const styleParam = params.get('style');
  const style =
    styleParam && isOverlayStyle(styleParam) ? styleParam : DEFAULT_CONFIG.style;
  const layout = params.get('layout') === 'stacked' ? 'stacked' : DEFAULT_CONFIG.layout;
  const teamsParam = params.get('teams');
  const legacyTeam = params.get('team');
  const gameIdRaw = params.get('gameId');
  const gameId = gameIdRaw ? Number(gameIdRaw) : undefined;
  const teams = teamsParam
    ? normalizeTeams(teamsParam.split(','))
    : legacyTeam
      ? normalizeTeams([legacyTeam])
      : DEFAULT_CONFIG.teams;
  const mode = gameId || teams.length ? 'manual' : 'auto';

  return {
    mode,
    style,
    layout,
    teams,
    gameId: Number.isFinite(gameId) ? gameId : undefined,
    playoffsOnly: parseBoolean(params.get('playoffs'), DEFAULT_CONFIG.playoffsOnly),
    showClock: parseBoolean(params.get('clock'), DEFAULT_CONFIG.showClock),
    showCredit: true,
    unlockToken: params.get('unlock') || undefined,
  };
}

export function buildOverlayUrl(config: OverlayConfig): string {
  const overlayUrl = new URL('./overlay.html', window.location.href);

  overlayUrl.searchParams.set('style', config.style);
  overlayUrl.searchParams.set('layout', config.layout);
  overlayUrl.searchParams.set('playoffs', config.playoffsOnly ? '1' : '0');
  overlayUrl.searchParams.set('clock', config.showClock ? '1' : '0');

  if (config.teams.length) {
    overlayUrl.searchParams.set('teams', config.teams.join(','));
  }

  return overlayUrl.toString();
}
