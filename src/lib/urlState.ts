import { isOverlayStyle } from './overlayStyles';
import type { OverlayConfig } from './types';

export const DEFAULT_CONFIG: OverlayConfig = {
  mode: 'auto',
  style: 'broadcast',
  team: 'AUTO',
  playoffsOnly: true,
  showClock: true,
};

function parseBoolean(value: string | null, fallback: boolean): boolean {
  if (value === null) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function parseConfig(search: string): OverlayConfig {
  const params = new URLSearchParams(search);
  const mode = params.get('mode') === 'manual' ? 'manual' : 'auto';
  const styleParam = params.get('style');
  const style =
    styleParam && isOverlayStyle(styleParam) ? styleParam : DEFAULT_CONFIG.style;
  const team = (params.get('team') || DEFAULT_CONFIG.team).toUpperCase();
  const gameIdRaw = params.get('gameId');
  const gameId = gameIdRaw ? Number(gameIdRaw) : undefined;

  return {
    mode,
    style,
    team: team || DEFAULT_CONFIG.team,
    gameId: Number.isFinite(gameId) ? gameId : undefined,
    playoffsOnly: parseBoolean(params.get('playoffs'), DEFAULT_CONFIG.playoffsOnly),
    showClock: parseBoolean(params.get('clock'), DEFAULT_CONFIG.showClock),
  };
}

export function buildOverlayUrl(config: OverlayConfig): string {
  const overlayUrl = new URL('./overlay.html', window.location.href);

  overlayUrl.searchParams.set('mode', config.mode);
  overlayUrl.searchParams.set('style', config.style);
  overlayUrl.searchParams.set('playoffs', config.playoffsOnly ? '1' : '0');
  overlayUrl.searchParams.set('clock', config.showClock ? '1' : '0');

  if (config.mode === 'auto') {
    if (config.team !== 'AUTO') {
      overlayUrl.searchParams.set('team', config.team);
    }
  } else if (config.gameId) {
    overlayUrl.searchParams.set('gameId', String(config.gameId));
  }

  return overlayUrl.toString();
}
