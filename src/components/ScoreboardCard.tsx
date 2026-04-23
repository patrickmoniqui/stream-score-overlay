import { useEffect, useRef, useState } from 'react';
import {
  CREDIT_LABEL,
  CREDIT_NAME,
} from '../lib/credit';
import {
  getCompactSeriesState,
  getSeriesLine,
  getStatusBadge,
  getStatusDetail,
} from '../lib/format';
import { isFinalGame, isLiveGame, isUpcomingGame } from '../lib/gameSelection';
import { useCreditReveal } from '../lib/useCreditReveal';
import type {
  NhlGame,
  OverlayLayout,
  OverlayStyle,
  TeamRecord,
} from '../lib/types';

interface ScoreboardCardProps {
  game: NhlGame | null;
  previousGame?: NhlGame | null;
  showClock: boolean;
  muted: boolean;
  style: OverlayStyle;
  layout: OverlayLayout;
  showCredit: boolean;
  debugGoalFlash?: {
    key: number;
    alignment: 'away' | 'home';
  } | null;
  className?: string;
  emptyLabel?: string;
}

const GOAL_FLASH_DURATION_MS = 30_000;
const GOAL_HORN_DURATION_MS = 3_000;
const UPCOMING_DETAIL_ROTATION_MS = 10_000;

interface GoalFlashState {
  key: number;
  team: TeamRecord;
  alignment: 'away' | 'home';
}

type GoalHornCleanup = () => void;

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

function GoalFlash({
  goalFlash,
}: {
  goalFlash: GoalFlashState;
}) {
  const logo = getTeamLogo(goalFlash.team);

  return (
    <div className={`goal-flash goal-flash-${goalFlash.alignment}`}>
      <div className="goal-flash-content">
        <div className="goal-flash-kicker">GOAL!</div>
        <div className="goal-flash-team">
          {logo ? (
            <img
              src={logo}
              alt={`${goalFlash.team.abbrev} logo`}
              className="goal-flash-logo"
            />
          ) : (
            <span className="goal-flash-logo-fallback">
              {goalFlash.team.abbrev}
            </span>
          )}
          <span className="goal-flash-abbrev">{goalFlash.team.abbrev}</span>
        </div>
      </div>
    </div>
  );
}

function getCompactMetaText(game: NhlGame, detail: string): string {
  const badge = getStatusBadge(game);

  if (badge === 'FINAL') {
    return detail === 'REGULATION' ? 'FINAL' : `FINAL ${detail}`;
  }

  if (badge === 'UP NEXT') {
    return detail;
  }

  return detail;
}

function useDisplayedStatusDetail(
  game: NhlGame | null,
  showClock: boolean,
  previousGame: NhlGame | null,
): string {
  const [showPreviousResult, setShowPreviousResult] = useState(true);
  const gameId = game?.id ?? null;
  const gameState = game?.gameState ?? null;
  const gameStartTime = game?.startTimeUTC ?? null;
  const previousGameId = previousGame?.id ?? null;
  const previousAwayScore = previousGame?.awayTeam.score ?? null;
  const previousHomeScore = previousGame?.homeTeam.score ?? null;
  const previousStartTime = previousGame?.startTimeUTC ?? null;
  const canRotate =
    !!game && !!previousGame && isUpcomingGame(game);

  useEffect(() => {
    if (!canRotate) {
      setShowPreviousResult(true);
      return;
    }

    setShowPreviousResult(true);

    const intervalId = window.setInterval(() => {
      setShowPreviousResult((current) => !current);
    }, UPCOMING_DETAIL_ROTATION_MS);

    return () => window.clearInterval(intervalId);
  }, [
    canRotate,
    gameId,
    gameState,
    gameStartTime,
    previousGameId,
    previousAwayScore,
    previousHomeScore,
    previousStartTime,
  ]);

  if (!game) {
    return '';
  }

  if (!previousGame || !isUpcomingGame(game)) {
    return getStatusDetail(game, showClock, previousGame);
  }

  return showPreviousResult
    ? getStatusDetail(game, showClock, previousGame)
    : getStatusDetail(game, showClock);
}

function useGoalFlash(game: NhlGame | null): GoalFlashState | null {
  const [goalFlash, setGoalFlash] = useState<GoalFlashState | null>(null);
  const previousGameRef = useRef<NhlGame | null>(null);

  useEffect(() => {
    const previousGame = previousGameRef.current;

    if (!game) {
      previousGameRef.current = null;
      return;
    }

    if (previousGame && previousGame.id === game.id && isLiveGame(game)) {
      const previousAwayScore = previousGame.awayTeam.score ?? 0;
      const previousHomeScore = previousGame.homeTeam.score ?? 0;
      const nextAwayScore = game.awayTeam.score ?? 0;
      const nextHomeScore = game.homeTeam.score ?? 0;
      const awayIncrease = nextAwayScore - previousAwayScore;
      const homeIncrease = nextHomeScore - previousHomeScore;

      if (awayIncrease > 0 && homeIncrease <= 0) {
        setGoalFlash({
          key: Date.now(),
          team: game.awayTeam,
          alignment: 'away',
        });
      } else if (homeIncrease > 0 && awayIncrease <= 0) {
        setGoalFlash({
          key: Date.now(),
          team: game.homeTeam,
          alignment: 'home',
        });
      }
    }

    previousGameRef.current = game;
  }, [game]);

  useEffect(() => {
    if (!goalFlash) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setGoalFlash((currentGoalFlash) =>
        currentGoalFlash?.key === goalFlash.key ? null : currentGoalFlash,
      );
    }, GOAL_FLASH_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [goalFlash]);

  return goalFlash;
}

function disconnectAudioNode(node: AudioNode) {
  try {
    node.disconnect();
  } catch {
    // Disconnect can throw if the node was already released.
  }
}

function stopAudioSource(source: AudioScheduledSourceNode, time: number) {
  try {
    source.stop(time);
  } catch {
    // Stop can throw if the source has already ended.
  }
}

async function playGoalHorn(audioContext: AudioContext): Promise<GoalHornCleanup | null> {
  if (audioContext.state === 'closed') {
    return null;
  }

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  const startTime = audioContext.currentTime + 0.02;
  const endTime = startTime + GOAL_HORN_DURATION_MS / 1_000;
  const masterGain = audioContext.createGain();
  const audioNodes: AudioNode[] = [masterGain];
  const sources: AudioScheduledSourceNode[] = [];

  masterGain.gain.setValueAtTime(0.18, startTime);
  masterGain.connect(audioContext.destination);

  [
    { frequency: 311.13, detune: -8, gain: 0.4 },
    { frequency: 392, detune: 5, gain: 0.32 },
    { frequency: 466.16, detune: 0, gain: 0.24 },
  ].forEach(({ frequency, detune, gain }) => {
    const oscillator = audioContext.createOscillator();
    const vibrato = audioContext.createOscillator();
    const vibratoGain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    const voiceGain = audioContext.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.detune.setValueAtTime(detune, startTime);

    vibrato.type = 'sine';
    vibrato.frequency.setValueAtTime(4.8, startTime);
    vibratoGain.gain.setValueAtTime(12, startTime);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(Math.max(680, frequency * 2.15), startTime);
    filter.Q.setValueAtTime(0.8, startTime);

    voiceGain.gain.setValueAtTime(0.0001, startTime);
    voiceGain.gain.linearRampToValueAtTime(gain, startTime + 0.08);
    voiceGain.gain.setValueAtTime(gain, endTime - 0.18);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    vibrato.connect(vibratoGain);
    vibratoGain.connect(oscillator.detune);
    oscillator.connect(filter);
    filter.connect(voiceGain);
    voiceGain.connect(masterGain);

    oscillator.start(startTime);
    vibrato.start(startTime);
    oscillator.stop(endTime);
    vibrato.stop(endTime);

    sources.push(oscillator, vibrato);
    audioNodes.push(vibratoGain, filter, voiceGain);
  });

  let released = false;
  const cleanupTimeoutId = window.setTimeout(() => {
    cleanup();
  }, GOAL_HORN_DURATION_MS + 250);

  function cleanup() {
    if (released) {
      return;
    }

    released = true;
    window.clearTimeout(cleanupTimeoutId);
    const stopTime = audioContext.currentTime;

    sources.forEach((source) => {
      stopAudioSource(source, stopTime);
      disconnectAudioNode(source);
    });

    audioNodes.forEach(disconnectAudioNode);
  }

  return cleanup;
}

function useGoalHorn(goalFlash: GoalFlashState | null, muted: boolean) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeHornCleanupRef = useRef<GoalHornCleanup | null>(null);
  const lastPlayedGoalKeyRef = useRef<number | null>(null);

  useEffect(() => {
    if (muted) {
      activeHornCleanupRef.current?.();
      activeHornCleanupRef.current = null;
    }

    if (!goalFlash) {
      return;
    }

    if (lastPlayedGoalKeyRef.current === goalFlash.key) {
      return;
    }

    lastPlayedGoalKeyRef.current = goalFlash.key;

    if (muted || typeof window.AudioContext !== 'function') {
      return;
    }

    const audioContext =
      audioContextRef.current ?? new window.AudioContext();

    audioContextRef.current = audioContext;
    activeHornCleanupRef.current?.();
    activeHornCleanupRef.current = null;

    let cancelled = false;

    void playGoalHorn(audioContext)
      .then((cleanup) => {
        if (cancelled) {
          cleanup?.();
          return;
        }

        activeHornCleanupRef.current = cleanup;
      })
      .catch(() => {
        // Audio playback is best-effort and can be blocked by browser policy.
      });

    return () => {
      cancelled = true;
    };
  }, [goalFlash, muted]);

  useEffect(() => {
    return () => {
      activeHornCleanupRef.current?.();
      activeHornCleanupRef.current = null;

      if (!audioContextRef.current) {
        return;
      }

      void audioContextRef.current.close().catch(() => {
        // Ignore shutdown failures during unmount.
      });
    };
  }, []);
}

export function ScoreboardCard({
  game,
  previousGame = null,
  showClock,
  muted,
  style,
  layout,
  showCredit,
  debugGoalFlash = null,
  className,
  emptyLabel = 'No game scheduled',
}: ScoreboardCardProps) {
  const showCreditReveal = useCreditReveal(showCredit);
  const goalFlash = useGoalFlash(game);
  const statusDetail = useDisplayedStatusDetail(game, showClock, previousGame);
  const [manualGoalFlash, setManualGoalFlash] = useState<GoalFlashState | null>(null);

  useEffect(() => {
    if (!game || !debugGoalFlash) {
      return;
    }

    setManualGoalFlash({
      key: debugGoalFlash.key,
      team:
        debugGoalFlash.alignment === 'away' ? game.awayTeam : game.homeTeam,
      alignment: debugGoalFlash.alignment,
    });
  }, [debugGoalFlash, game]);

  useEffect(() => {
    if (!manualGoalFlash) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setManualGoalFlash((currentGoalFlash) =>
        currentGoalFlash?.key === manualGoalFlash.key ? null : currentGoalFlash,
      );
    }, GOAL_FLASH_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [manualGoalFlash]);

  const activeGoalFlash = manualGoalFlash ?? goalFlash;

  useGoalHorn(activeGoalFlash, muted);

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
        {activeGoalFlash ? <GoalFlash key={activeGoalFlash.key} goalFlash={activeGoalFlash} /> : null}
      </div>
    );
  }

  const statusTone = getStatusTone(game);
  const isCompact = layout === 'compact';
  const footerText = showCreditReveal ? CREDIT_LABEL : getSeriesLine(game);
  const compactSeriesState = getCompactSeriesState(game);

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
                {getCompactMetaText(game, statusDetail)}
              </div>
              {compactSeriesState ? (
                <div className="compact-meta-series">{compactSeriesState}</div>
              ) : null}
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
            <div className="status-detail">{statusDetail}</div>
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
      {activeGoalFlash ? (
        <GoalFlash key={activeGoalFlash.key} goalFlash={activeGoalFlash} />
      ) : null}
    </div>
  );
}
