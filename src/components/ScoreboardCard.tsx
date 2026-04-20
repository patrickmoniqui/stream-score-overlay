import {
  getSeriesLine,
  getStatusBadge,
  getStatusDetail,
} from '../lib/format';
import { isFinalGame, isLiveGame } from '../lib/gameSelection';
import type { NhlGame, OverlayStyle, TeamRecord } from '../lib/types';

interface ScoreboardCardProps {
  game: NhlGame | null;
  showClock: boolean;
  style: OverlayStyle;
  className?: string;
  emptyLabel?: string;
}

function getTeamName(team: TeamRecord): string {
  return (team.commonName?.default ?? team.abbrev).toUpperCase();
}

function getTeamLocation(team: TeamRecord): string {
  return team.placeName?.default.toUpperCase() ?? '';
}

function getTeamLogo(team: TeamRecord): string | undefined {
  return team.logo ?? team.darkLogo;
}

function getStatusTone(game: NhlGame): string {
  if (isLiveGame(game)) {
    return game.clock?.inIntermission ? 'intermission' : 'live';
  }

  if (isFinalGame(game)) {
    return 'final';
  }

  return 'upcoming';
}

function TeamRow({
  team,
  score,
  alignment,
}: {
  team: TeamRecord;
  score: number;
  alignment: 'away' | 'home';
}) {
  const logo = getTeamLogo(team);
  const location = getTeamLocation(team);
  const name = getTeamName(team);

  return (
    <div className={`scorebug-row scorebug-row-${alignment}`}>
      <div className="team-flag" />
      <div className="team-emblem">
        {logo ? (
          <img
            src={logo}
            alt={`${location || team.abbrev} ${name} logo`}
            className="team-logo"
          />
        ) : (
          <span className="team-logo-fallback">{team.abbrev}</span>
        )}
      </div>
      <div className="team-copy">
        {location ? <span className="team-location">{location}</span> : null}
        <div className="team-line">
          <span className="team-code">{team.abbrev}</span>
          <span className="team-name">{name}</span>
        </div>
      </div>
      <div className="team-score-box">
        <span className="team-score">{score}</span>
      </div>
    </div>
  );
}

export function ScoreboardCard({
  game,
  showClock,
  style,
  className,
  emptyLabel = 'No game scheduled',
}: ScoreboardCardProps) {
  if (!game) {
    return (
      <div
        className={`scoreboard-card ${className ?? ''}`.trim()}
        data-style={style}
      >
        <div className="scoreboard-empty">{emptyLabel}</div>
      </div>
    );
  }

  const seriesLine = getSeriesLine(game);
  const statusTone = getStatusTone(game);

  return (
    <div
      className={`scoreboard-card ${className ?? ''}`.trim()}
      data-style={style}
    >
      <div className="scorebug-header">
        <div className={`status-pill status-pill-${statusTone}`}>
          {getStatusBadge(game)}
        </div>
        <div className="status-rail" />
        <div className="status-detail">{getStatusDetail(game, showClock)}</div>
      </div>
      <div className="scoreboard-main">
        <TeamRow
          team={game.awayTeam}
          score={game.awayTeam.score ?? 0}
          alignment="away"
        />
        <TeamRow
          team={game.homeTeam}
          score={game.homeTeam.score ?? 0}
          alignment="home"
        />
      </div>
      {seriesLine ? (
        <div className="scorebug-footer">
          <div className="series-line">{seriesLine}</div>
        </div>
      ) : null}
    </div>
  );
}
