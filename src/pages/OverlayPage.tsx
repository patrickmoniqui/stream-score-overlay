import { useMemo } from 'react';
import { parseConfig } from '../lib/urlState';
import { useOverlayData } from '../lib/useOverlayData';
import { ScoreboardCard } from '../components/ScoreboardCard';
import { findPreviousFinalGame } from '../lib/gameSelection';

export function OverlayPage() {
  const config = useMemo(() => parseConfig(window.location.search), []);
  const { data, error } = useOverlayData(config);
  const previousGame = findPreviousFinalGame(data.selectedGame, data.games);

  return (
    <main className="overlay-page">
      {error ? (
        <div className="overlay-error">{error}</div>
      ) : (
        <ScoreboardCard
          game={data.selectedGame}
          previousGame={previousGame}
          showClock={config.showClock}
          style={config.style}
          layout={config.layout}
          showCredit
          className="overlay-card"
        />
      )}
    </main>
  );
}
