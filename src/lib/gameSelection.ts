import type {
  NhlGame,
  OverlayConfig,
  ScheduleResponse,
  ScoreResponse,
} from './types';
import { MIN_REFRESH_SECONDS } from './urlState';

const LIVE_STATES = new Set(['LIVE', 'CRIT']);
const UPCOMING_STATES = new Set(['PRE', 'FUT']);
const FINAL_STATES = new Set(['FINAL', 'OFF']);

function mergeGame(baseGame: NhlGame, scoreGame?: NhlGame): NhlGame {
  if (!scoreGame) {
    return baseGame;
  }

  return {
    ...baseGame,
    ...scoreGame,
    awayTeam: {
      ...baseGame.awayTeam,
      ...scoreGame.awayTeam,
    },
    homeTeam: {
      ...baseGame.homeTeam,
      ...scoreGame.homeTeam,
    },
    periodDescriptor: scoreGame.periodDescriptor ?? baseGame.periodDescriptor,
    seriesStatus: scoreGame.seriesStatus ?? baseGame.seriesStatus,
    clock: scoreGame.clock ?? baseGame.clock,
  };
}

export function buildMergedGames(
  schedule: ScheduleResponse | null,
  score: ScoreResponse | null,
): NhlGame[] {
  if (!schedule) {
    return score?.games ?? [];
  }

  const scoreById = new Map((score?.games ?? []).map((game) => [game.id, game]));

  return schedule.gameWeek.flatMap((day) =>
    day.games.map((game) => mergeGame(game, scoreById.get(game.id))),
  );
}

export function getTeamMatch(game: NhlGame, team: string): boolean {
  return game.awayTeam.abbrev === team || game.homeTeam.abbrev === team;
}

export function isPlayoffGame(game: NhlGame): boolean {
  return game.gameType === 3;
}

export function isLiveGame(game: NhlGame): boolean {
  return LIVE_STATES.has(game.gameState);
}

export function isUpcomingGame(game: NhlGame): boolean {
  return UPCOMING_STATES.has(game.gameState);
}

export function isFinalGame(game: NhlGame): boolean {
  return FINAL_STATES.has(game.gameState);
}

function isSameMatchup(a: NhlGame, b: NhlGame): boolean {
  const aTeamIds = [a.awayTeam.id, a.homeTeam.id].sort((left, right) => left - right);
  const bTeamIds = [b.awayTeam.id, b.homeTeam.id].sort((left, right) => left - right);

  return aTeamIds[0] === bTeamIds[0] && aTeamIds[1] === bTeamIds[1];
}

function getStartMs(game: NhlGame): number {
  return new Date(game.startTimeUTC).getTime();
}

function compareAscending(a: NhlGame, b: NhlGame): number {
  return getStartMs(a) - getStartMs(b);
}

function compareDescending(a: NhlGame, b: NhlGame): number {
  return getStartMs(b) - getStartMs(a);
}

export function selectGame(
  config: OverlayConfig,
  games: NhlGame[],
  now = Date.now(),
): NhlGame | null {
  const eligibleGames = games.filter((game) => {
    if (config.playoffsOnly && !isPlayoffGame(game)) {
      return false;
    }

    return true;
  });

  if (!eligibleGames.length) {
    return null;
  }

  if (config.gameId) {
    return eligibleGames.find((game) => game.id === config.gameId) ?? null;
  }

  const selectedTeams = new Set(config.teams);
  const filteredGames =
    selectedTeams.size
      ? eligibleGames.filter(
          (game) =>
            selectedTeams.has(game.awayTeam.abbrev) ||
            selectedTeams.has(game.homeTeam.abbrev),
        )
      : eligibleGames;

  if (!filteredGames.length) {
    return null;
  }

  const liveGames = filteredGames.filter(isLiveGame).sort(compareAscending);

  if (liveGames.length) {
    return liveGames[0];
  }

  const upcomingGames = filteredGames
    .filter((game) => isUpcomingGame(game) || getStartMs(game) >= now)
    .sort(compareAscending);

  if (upcomingGames.length) {
    return upcomingGames[0];
  }

  const finalGames = filteredGames.filter(isFinalGame).sort(compareDescending);

  if (finalGames.length) {
    return finalGames[0];
  }

  return filteredGames.sort(compareAscending)[0] ?? null;
}

export function getRefreshInterval(refreshSeconds: number): number {
  return Math.max(MIN_REFRESH_SECONDS, refreshSeconds) * 1_000;
}

export function findPreviousFinalGame(
  game: NhlGame | null,
  games: NhlGame[],
): NhlGame | null {
  if (!game) {
    return null;
  }

  return (
    games
      .filter(
        (candidate) =>
          candidate.id !== game.id &&
          isFinalGame(candidate) &&
          isSameMatchup(candidate, game) &&
          getStartMs(candidate) < getStartMs(game),
      )
      .sort(compareDescending)[0] ?? null
  );
}
