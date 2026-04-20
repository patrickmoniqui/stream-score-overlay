import { useEffect, useState } from 'react';
import {
  CREDIT_LABEL,
  CREDIT_NAME,
  CREDIT_REVEAL_DURATION_MS,
  CREDIT_REVEAL_INTERVAL_MS,
} from '../lib/credit';
import {
  getSeriesLine,
  getStatusBadge,
  getStatusDetail,
} from '../lib/format';
import { isFinalGame, isLiveGame } from '../lib/gameSelection';
import type {
  NhlGame,
  OverlayLayout,
  OverlayStyle,
  TeamRecord,
} from '../lib/types';

interface ScoreboardCardProps {
  game: NhlGame | null;
  showClock: boolean;
  style: OverlayStyle;
  layout: OverlayLayout;
  showCredit: boolean;
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

function CompactTeam({
  team,
  score,
  alignment,
}: {
  team: TeamRecord;
  score: number;
  alignment: 'away' | 'home';
}) {
  const logo = getTeamLogo(team);
  const name = getTeamName(team);
  const logoSlot = logo ? (
    <img
      src={logo}
      alt={`${team.abbrev} logo`}
      className="compact-team-logo"
    />
  ) : (
    <span className="compact-team-logo-fallback">{team.abbrev}</span>
  );
  const scoreSlot = <div className="compact-team-score">{score}</div>;

  return (
    <div className={`compact-team compact-team-${alignment}`} title={name}>
      {alignment === 'away' ? (
        <>
          <div className="compact-team-copy">{logoSlot}</div>
          {scoreSlot}
        </>
      ) : (
        <>
          {scoreSlot}
          <div className="compact-team-copy">{logoSlot}</div>
        </>
      )}
    </div>
  );
}

function TwitchIcon() {
  return (
    <svg
      className="twitch-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M4 3h16v11l-4 4h-4l-2 3H7v-3H4V3zm2 2v11h3v2l2-2h4l3-3V5H6zm4 3h2v4h-2V8zm5 0h2v4h-2V8z"
      />
    </svg>
  );
}

function getCompactMetaText(game: NhlGame, showClock: boolean): string {
  const badge = getStatusBadge(game);
  const detail = getStatusDetail(game, showClock);

  if (badge === 'FINAL') {
    return detail === 'REGULATION' ? 'FINAL' : `FINAL ${detail}`;
  }

  if (badge === 'UP NEXT') {
    return detail;
  }

  return detail;
}

function useCreditReveal(enabled: boolean): boolean {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsVisible(false);
      return;
    }

    let revealTimeoutId: number | undefined;
    let hideTimeoutId: number | undefined;

    function scheduleReveal() {
      revealTimeoutId = window.setTimeout(() => {
        setIsVisible(true);
        hideTimeoutId = window.setTimeout(() => {
          setIsVisible(false);
          scheduleReveal();
        }, CREDIT_REVEAL_DURATION_MS);
      }, CREDIT_REVEAL_INTERVAL_MS);
    }

    scheduleReveal();

    return () => {
      if (revealTimeoutId) {
        window.clearTimeout(revealTimeoutId);
      }

      if (hideTimeoutId) {
        window.clearTimeout(hideTimeoutId);
      }
    };
  }, [enabled]);

  return enabled && isVisible;
}

export function ScoreboardCard({
  game,
  showClock,
  style,
  layout,
  showCredit,
  className,
  emptyLabel = 'No game scheduled',
}: ScoreboardCardProps) {
  const showCreditReveal = useCreditReveal(showCredit);

  if (!game) {
    return (
      <div
        className={`scoreboard-card ${className ?? ''}`.trim()}
        data-style={style}
        data-layout={layout}
      >
        <div className="scoreboard-empty">{emptyLabel}</div>
        {showCreditReveal ? (
          <div className="scoreboard-empty-credit">{CREDIT_LABEL}</div>
        ) : null}
      </div>
    );
  }

  const statusTone = getStatusTone(game);
  const isCompact = layout === 'compact';
  const footerText = showCreditReveal ? CREDIT_LABEL : getSeriesLine(game);

  return (
    <div
      className={`scoreboard-card ${className ?? ''}`.trim()}
      data-style={style}
      data-layout={layout}
    >
      {isCompact ? (
        <>
          <div className="scorebug-compact">
            <CompactTeam
              team={game.awayTeam}
              score={game.awayTeam.score ?? 0}
              alignment="away"
            />
            <div className="compact-meta">
              <div className="compact-meta-detail">
                {getCompactMetaText(game, showClock)}
              </div>
            </div>
            <CompactTeam
              team={game.homeTeam}
              score={game.homeTeam.score ?? 0}
              alignment="home"
            />
          </div>
          {showCreditReveal ? (
            <div className="scorebug-compact-credit-bar compact-credit">
              <span className="compact-credit-by">by</span>
              <span className="compact-credit-brand">
                <TwitchIcon />
                <span>{CREDIT_NAME}</span>
              </span>
            </div>
          ) : null}
        </>
      ) : (
        <>
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
          {footerText ? (
            <div className="scorebug-footer">
              <div className={`series-line ${showCreditReveal ? 'credit-line' : ''}`}>
                {footerText}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
