import { MultiScoreboardCard } from './MultiScoreboardCard';
import { ScoreboardCard } from './ScoreboardCard';
import type { DataSnapshot, OverlayConfig, NhlGame } from '../lib/types';

interface SelectedScoreboardCardProps {
  displayMode: DataSnapshot['displayMode'];
  selectedGame: NhlGame | null;
  selectedGames: NhlGame[];
  previousGame?: NhlGame | null;
  showClock: boolean;
  muted: boolean;
  style: OverlayConfig['style'];
  layout: OverlayConfig['layout'];
  showCredit: boolean;
  debugGoalFlash?: {
    key: number;
    alignment: 'away' | 'home';
  } | null;
  className?: string;
  emptyLabel?: string;
}

export function SelectedScoreboardCard({
  displayMode,
  selectedGame,
  selectedGames,
  previousGame = null,
  showClock,
  muted,
  style,
  layout,
  showCredit,
  debugGoalFlash = null,
  className,
  emptyLabel,
}: SelectedScoreboardCardProps) {
  if (displayMode === 'multi' && selectedGames.length > 1) {
    return (
      <MultiScoreboardCard
        primaryGame={selectedGame}
        games={selectedGames}
        showClock={showClock}
        style={style}
        showCredit={showCredit}
        className={className}
        emptyLabel={emptyLabel}
      />
    );
  }

  return (
    <ScoreboardCard
      game={selectedGame}
      previousGame={previousGame}
      showClock={showClock}
      muted={muted}
      style={style}
      layout={layout}
      showCredit={showCredit}
      debugGoalFlash={debugGoalFlash}
      className={className}
      emptyLabel={emptyLabel}
    />
  );
}
