import { getStatusLine, getSeriesLine } from '../lib/format';
import type { NhlGame } from '../lib/types';

interface ScoreboardCardProps {
  game: NhlGame | null;
  showClock: boolean;
  className?: string;
  emptyLabel?: string;
}

export function ScoreboardCard({
  game,
  showClock,
  className,
  emptyLabel = 'No game scheduled',
}: ScoreboardCardProps) {
  if (!game) {
    return (
      <div className={`scoreboard-card ${className ?? ''}`.trim()}>
        <div className="scoreboard-empty">{emptyLabel}</div>
      </div>
    );
  }

  const seriesLine = getSeriesLine(game);

  return (
    <div className={`scoreboard-card ${className ?? ''}`.trim()}>
      <div className="scoreboard-main">
        <div className="scoreboard-team">
          <span className="team-code">{game.awayTeam.abbrev}</span>
          <span className="team-score">{game.awayTeam.score ?? 0}</span>
        </div>
        <div className="scoreboard-status">
          <div className="status-line">{getStatusLine(game, showClock)}</div>
          {seriesLine ? <div className="series-line">{seriesLine}</div> : null}
        </div>
        <div className="scoreboard-team scoreboard-team-home">
          <span className="team-code">{game.homeTeam.abbrev}</span>
          <span className="team-score">{game.homeTeam.score ?? 0}</span>
        </div>
      </div>
    </div>
  );
}

