import { isFinalGame, isLiveGame } from './gameSelection';
import type { NhlGame } from './types';

function ordinal(value: number): string {
  if (value === 1) {
    return '1st';
  }

  if (value === 2) {
    return '2nd';
  }

  if (value === 3) {
    return '3rd';
  }

  return `${value}th`;
}

export function formatPeriodLabel(game: NhlGame): string {
  const descriptor = game.periodDescriptor;

  if (!descriptor) {
    return '';
  }

  if (descriptor.periodType === 'SO') {
    return 'SO';
  }

  if (descriptor.periodType === 'OT') {
    return descriptor.number > 4 ? `${descriptor.number - 3}OT` : 'OT';
  }

  return ordinal(descriptor.number);
}

export function formatStartTime(isoTime: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoTime));
}

export function formatGameLabel(game: NhlGame): string {
  const away = game.awayTeam.abbrev;
  const home = game.homeTeam.abbrev;
  const startTime = formatStartTime(game.startTimeUTC);

  return `${away} @ ${home} · ${startTime}`;
}

export function getStatusLine(game: NhlGame, showClock: boolean): string {
  if (isLiveGame(game)) {
    const clock = game.clock;
    const period = formatPeriodLabel(game);

    if (clock?.inIntermission) {
      return period ? `INT · ${period}` : 'INT';
    }

    if (showClock && clock?.timeRemaining) {
      return period ? `${period} · ${clock.timeRemaining}` : clock.timeRemaining;
    }

    return period ? `LIVE · ${period}` : 'LIVE';
  }

  if (isFinalGame(game)) {
    return 'FINAL';
  }

  return formatStartTime(game.startTimeUTC);
}

export function getSeriesLine(game: NhlGame): string | null {
  const series = game.seriesStatus;

  if (!series) {
    return null;
  }

  return `${series.topSeedTeamAbbrev} ${series.topSeedWins}-${series.bottomSeedWins} ${series.bottomSeedTeamAbbrev}`;
}

