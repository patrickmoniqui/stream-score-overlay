import { useEffect, useMemo, useState } from 'react';
import { parseConfig } from '../lib/urlState';
import { useOverlayData } from '../lib/useOverlayData';
import { ScoreboardCard } from '../components/ScoreboardCard';
import { isTwitchGateEnabled } from '../lib/features';
import { verifyTwitchGateToken } from '../lib/twitchGate';
import { findPreviousFinalGame } from '../lib/gameSelection';

export function OverlayPage() {
  const config = useMemo(() => parseConfig(window.location.search), []);
  const twitchGateEnabled = isTwitchGateEnabled();
  const [unlockVerified, setUnlockVerified] = useState(!twitchGateEnabled);
  const { data, error } = useOverlayData(config);
  const previousGame = findPreviousFinalGame(data.selectedGame, data.games);

  useEffect(() => {
    if (!twitchGateEnabled || config.showCredit) {
      setUnlockVerified(true);
      return;
    }

    if (!config.unlockToken) {
      setUnlockVerified(false);
      return;
    }

    const controller = new AbortController();

    void verifyTwitchGateToken(config.unlockToken, controller.signal)
      .then((result) => {
        setUnlockVerified(result.enabled && result.valid && result.entitled);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setUnlockVerified(false);
        }
      });

    return () => controller.abort();
  }, [config.showCredit, config.unlockToken, twitchGateEnabled]);

  const effectiveShowCredit =
    config.showCredit || (twitchGateEnabled && !unlockVerified);

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
          showCredit={effectiveShowCredit}
          className="overlay-card"
        />
      )}
    </main>
  );
}
