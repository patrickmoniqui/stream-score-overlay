import { useEffect, useMemo } from 'react';
import { SelectedScoreboardCard } from '../components/SelectedScoreboardCard';
import {
  getAnalyticsInstallId,
  getInstallIdFromSearch,
  trackAnalyticsEvent,
} from '../lib/analytics';
import { parseConfig } from '../lib/urlState';
import { useOverlayData } from '../lib/useOverlayData';
import { findPreviousFinalGame } from '../lib/gameSelection';

export function OverlayPage() {
  const config = useMemo(() => parseConfig(window.location.search), []);
  const installId = useMemo(
    () => getInstallIdFromSearch(window.location.search) ?? getAnalyticsInstallId(),
    [],
  );
  const { data, error } = useOverlayData(config);
  const previousGame = findPreviousFinalGame(data.selectedGame, data.games);

  useEffect(() => {
    void trackAnalyticsEvent('overlay_loaded', config, { installId });
  }, [config, installId]);

  return (
    <main className="overlay-page">
      {error ? (
        <div className="overlay-error">{error}</div>
      ) : (
        <SelectedScoreboardCard
          displayMode={data.displayMode}
          selectedGame={data.selectedGame}
          selectedGames={data.selectedGames}
          previousGame={previousGame}
          showClock={config.showClock}
          muted={config.muted}
          style={config.style}
          layout={config.layout}
          goalAnimation={config.goalAnimation}
          showCredit
          className="overlay-card"
        />
      )}
    </main>
  );
}
