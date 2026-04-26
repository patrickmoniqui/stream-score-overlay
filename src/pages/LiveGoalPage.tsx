import { useEffect, useMemo, useRef, useState } from 'react';
import { GoalFlash, type GoalFlashState } from '../components/GoalFlash';
import { getAnalyticsInstallId, getInstallIdFromSearch, trackAnalyticsEvent } from '../lib/analytics';
import { parseConfig } from '../lib/urlState';
import { GOAL_FLASH_DURATION_MS, useGoalHorn, useSelectedGamesGoalFlash } from '../lib/useGoalEffects';
import { useOverlayData } from '../lib/useOverlayData';

function parseDebugGoal(search: string): 'away' | 'home' | null {
  const value = new URLSearchParams(search).get('debugGoal')?.toLowerCase();

  return value === 'away' || value === 'home' ? value : null;
}

export function LiveGoalPage() {
  const config = useMemo(() => parseConfig(window.location.search), []);
  const installId = useMemo(
    () => getInstallIdFromSearch(window.location.search) ?? getAnalyticsInstallId(),
    [],
  );
  const debugGoal = useMemo(() => parseDebugGoal(window.location.search), []);
  const debugGoalTriggeredRef = useRef(false);
  const [manualGoalFlash, setManualGoalFlash] = useState<GoalFlashState | null>(null);
  const { data, error } = useOverlayData(config);
  const gamesToWatch = data.selectedGames.length
    ? data.selectedGames
    : data.selectedGame
      ? [data.selectedGame]
      : [];
  const detectedGoalFlash = useSelectedGamesGoalFlash(gamesToWatch);
  const activeGoalFlash = manualGoalFlash ?? detectedGoalFlash;

  useGoalHorn(activeGoalFlash, config.muted);

  useEffect(() => {
    void trackAnalyticsEvent('live_goal_overlay_loaded', config, { installId });
  }, [config, installId]);

  useEffect(() => {
    if (!debugGoal || debugGoalTriggeredRef.current) {
      return;
    }

    const game = data.selectedGame ?? data.selectedGames[0] ?? null;

    if (!game) {
      return;
    }

    debugGoalTriggeredRef.current = true;
    setManualGoalFlash({
      key: Date.now(),
      gameId: game.id,
      team: debugGoal === 'away' ? game.awayTeam : game.homeTeam,
      alignment: debugGoal,
    });
  }, [data.selectedGame, data.selectedGames, debugGoal]);

  useEffect(() => {
    if (!manualGoalFlash) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setManualGoalFlash((currentGoalFlash) =>
        currentGoalFlash?.key === manualGoalFlash.key ? null : currentGoalFlash,
      );
    }, GOAL_FLASH_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [manualGoalFlash]);

  return (
    <main className="live-goal-page" aria-live="polite">
      <div
        className="live-goal-stage"
        data-style={config.style}
        data-layout={config.layout}
      >
        {activeGoalFlash ? (
          <GoalFlash key={activeGoalFlash.key} goalFlash={activeGoalFlash} />
        ) : null}
        {error ? <div className="live-goal-error">{error}</div> : null}
      </div>
    </main>
  );
}
