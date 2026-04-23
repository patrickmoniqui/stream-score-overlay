import { CREDIT_LABEL } from '../lib/credit';
import { getStatusBadge, getStatusDetail } from '../lib/format';
import { isFinalGame, isLiveGame } from '../lib/gameSelection';
import { useCreditReveal } from '../lib/useCreditReveal';
import type { NhlGame, OverlayStyle } from '../lib/types';

interface MultiScoreboardCardProps {
  primaryGame: NhlGame | null;
  games: NhlGame[];
  showClock: boolean;
  style: OverlayStyle;
  showCredit: boolean;
  className?: string;
  emptyLabel?: string;
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

function getTeamLogo(gameTeam: NhlGame['awayTeam']): string | undefined {
  return gameTeam.logo ?? gameTeam.darkLogo;
}

function getFooterText(gameCount: number): string {
  return gameCount === 1 ? 'Live look-in' : `${gameCount} live games`;
}

export function MultiScoreboardCard({
  primaryGame,
  games,
  showClock,
  style,
  showCredit,
  className,
  emptyLabel = 'No live games available',
}: MultiScoreboardCardProps) {
  const showCreditReveal = useCreditReveal(showCredit);

  if (!games.length) {
    return (
      <div
        className={`scoreboard-card multi-scoreboard-card ${className ?? ''}`.trim()}
        data-style={style}
        data-layout="compact"
      >
        <div className="scoreboard-empty">{emptyLabel}</div>
      </div>
    );
  }

  return (
    <div
      className={`scoreboard-card multi-scoreboard-card ${className ?? ''}`.trim()}
      data-style={style}
      data-layout="compact"
    >
      <div className="scorebug-header">
        <div className="status-pill status-pill-live">MULTI</div>
        <div className="status-rail" />
        <div className="status-detail">{getFooterText(games.length)}</div>
      </div>
      <div className="multi-scoreboard-list">
        {games.map((game) => {
          const awayLogo = getTeamLogo(game.awayTeam);
          const homeLogo = getTeamLogo(game.homeTeam);
          const isPrimaryGame = primaryGame?.id === game.id;

          return (
            <div
              key={game.id}
              className={`multi-scoreboard-row${isPrimaryGame ? ' is-primary' : ''}`}
            >
              <div className="multi-scoreboard-matchup">
                <div className="multi-scoreboard-team multi-scoreboard-team-away">
                  {awayLogo ? (
                    <img
                      src={awayLogo}
                      alt={`${game.awayTeam.abbrev} logo`}
                      className="multi-scoreboard-team-logo"
                    />
                  ) : (
                    <span className="multi-scoreboard-team-logo-fallback">
                      {game.awayTeam.abbrev}
                    </span>
                  )}
                  <span className="multi-scoreboard-team-code">
                    {game.awayTeam.abbrev}
                  </span>
                </div>
                <div className="multi-scoreboard-scoreline">
                  <span className="multi-scoreboard-score">
                    {game.awayTeam.score ?? 0}
                  </span>
                  <span className="multi-scoreboard-score-separator">-</span>
                  <span className="multi-scoreboard-score">
                    {game.homeTeam.score ?? 0}
                  </span>
                </div>
                <div className="multi-scoreboard-team multi-scoreboard-team-home">
                  <span className="multi-scoreboard-team-code">
                    {game.homeTeam.abbrev}
                  </span>
                  {homeLogo ? (
                    <img
                      src={homeLogo}
                      alt={`${game.homeTeam.abbrev} logo`}
                      className="multi-scoreboard-team-logo"
                    />
                  ) : (
                    <span className="multi-scoreboard-team-logo-fallback">
                      {game.homeTeam.abbrev}
                    </span>
                  )}
                </div>
              </div>
              <div className="multi-scoreboard-meta">
                <span className={`status-pill status-pill-${getStatusTone(game)}`}>
                  {getStatusBadge(game)}
                </span>
                <span className="multi-scoreboard-detail">
                  {getStatusDetail(game, showClock)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="scorebug-footer">
        <div className="series-line">
          {showCreditReveal ? CREDIT_LABEL : getFooterText(games.length)}
        </div>
      </div>
    </div>
  );
}
