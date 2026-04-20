import { parseConfig } from '../lib/urlState';
import { useOverlayData } from '../lib/useOverlayData';
import { ScoreboardCard } from '../components/ScoreboardCard';

export function OverlayPage() {
  const config = parseConfig(window.location.search);
  const { data, error } = useOverlayData(config);

  return (
    <main className="overlay-page">
      {error ? (
        <div className="overlay-error">{error}</div>
      ) : (
        <ScoreboardCard
          game={data.selectedGame}
          showClock={config.showClock}
          className="overlay-card"
        />
      )}
    </main>
  );
}

