import { useEffect, useState } from 'react';
import { fetchScheduleNow, fetchScoreNow } from './api';
import { buildMergedGames, getRefreshInterval, selectGame } from './gameSelection';
import type { DataSnapshot, OverlayConfig, ScheduleResponse, ScoreResponse } from './types';

interface OverlayDataState {
  data: DataSnapshot;
  loading: boolean;
  error: string | null;
}

function createEmptySnapshot(): DataSnapshot {
  return {
    games: [],
    selectedGame: null,
    schedule: null,
    score: null,
  };
}

export function useOverlayData(config: OverlayConfig): OverlayDataState {
  const [state, setState] = useState<OverlayDataState>({
    data: createEmptySnapshot(),
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;
    let activeController: AbortController | null = null;

    async function loadData() {
      activeController?.abort();
      activeController = new AbortController();

      try {
        const [schedule, score] = await Promise.all([
          fetchScheduleNow(activeController.signal),
          fetchScoreNow(activeController.signal),
        ]);

        if (cancelled) {
          return;
        }

        const mergedGames = buildMergedGames(schedule, score);
        const selectedGame = selectGame(config, mergedGames);

        setState({
          data: {
            games: mergedGames,
            selectedGame,
            schedule,
            score,
          },
          loading: false,
          error: null,
        });

        timeoutId = window.setTimeout(loadData, getRefreshInterval(selectedGame));
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error ? error.message : 'Unable to load NHL data.';

        setState((currentState) => ({
          data: currentState.data,
          loading: false,
          error: message,
        }));

        timeoutId = window.setTimeout(loadData, 30_000);
      }
    }

    setState((currentState) => ({
      data: currentState.data,
      loading: true,
      error: null,
    }));

    void loadData();

    return () => {
      cancelled = true;
      activeController?.abort();

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    config.gameId,
    config.mode,
    config.playoffsOnly,
    config.showClock,
    config.team,
  ]);

  return state;
}

