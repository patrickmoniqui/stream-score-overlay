import { useEffect, useMemo } from 'react';
import {
  getAnalyticsInstallId,
  getInstallIdFromSearch,
  trackAnalyticsEvent,
} from '../lib/analytics';
import { parseConfig } from '../lib/urlState';
import { useOverlayData } from '../lib/useOverlayData';
import { ScoreboardCard } from '../components/ScoreboardCard';
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
        <ScoreboardCard
          game={data.selectedGame}
          previousGame={previousGame}
          showClock={config.showClock}
          muted={config.muted}
          style={config.style}
          layout={config.layout}
          showCredit
          className="overlay-card"
        />
      )}
    </main>
  );
}
