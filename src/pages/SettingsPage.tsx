import { useEffect, useState } from 'react';
import { ScoreboardCard } from '../components/ScoreboardCard';
import {
  CREDIT_REVEAL_EVERY_MINUTES,
  CREDIT_REVEAL_FOR_SECONDS,
} from '../lib/credit';
import { isTwitchGateEnabled } from '../lib/features';
import { OVERLAY_STYLE_OPTIONS } from '../lib/overlayStyles';
import { NHL_TEAMS } from '../lib/teams';
import {
  buildTwitchLoginUrl,
  buildTwitchLogoutUrl,
  fetchTwitchGateStatus,
  type TwitchGateStatus,
} from '../lib/twitchGate';
import { findPreviousFinalGame } from '../lib/gameSelection';
import { useOverlayData } from '../lib/useOverlayData';
import { buildOverlayUrl, parseConfig } from '../lib/urlState';
import type { OverlayConfig } from '../lib/types';

const SELECTABLE_NHL_TEAMS = NHL_TEAMS.filter((team) => team.abbrev !== 'AUTO');
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

export function SettingsPage() {
  const twitchGateEnabled = isTwitchGateEnabled();
  const canUseTestingTools =
    import.meta.env.DEV || LOCAL_HOSTNAMES.has(window.location.hostname);
  const versionLabel = __APP_BUILD_NUMBER__
    ? `v${__APP_VERSION__} · build ${__APP_BUILD_NUMBER__}`
    : `v${__APP_VERSION__}`;
  const [config, setConfig] = useState<OverlayConfig>(() =>
    parseConfig(window.location.search),
  );
  const [developerMode, setDeveloperMode] = useState(false);
  const [previewGoalFlash, setPreviewGoalFlash] = useState<{
    key: number;
    alignment: 'away' | 'home';
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [twitchGateStatus, setTwitchGateStatus] = useState<TwitchGateStatus | null>(
    null,
  );
  const [twitchGateError, setTwitchGateError] = useState<string | null>(null);
  const { data, error, loading } = useOverlayData(config);
  const previousGame = findPreviousFinalGame(data.selectedGame, data.games);
  const selectedStyle =
    OVERLAY_STYLE_OPTIONS.find((option) => option.value === config.style) ??
    OVERLAY_STYLE_OPTIONS[0];
  const selectedTeamNames = SELECTABLE_NHL_TEAMS.filter((team) =>
    config.teams.includes(team.abbrev),
  ).map((team) => team.name);
  const teamPickerLabel =
    config.teams.length === 0
      ? 'Auto (follow schedule)'
      : config.teams.length <= 2
        ? selectedTeamNames.join(', ')
        : `${config.teams.length} teams selected`;

  useEffect(() => {
    const nextSearch = new URL(buildOverlayUrl(config)).search;
    window.history.replaceState({}, '', `${window.location.pathname}${nextSearch}`);
  }, [config]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopied(false), 1_500);

    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  useEffect(() => {
    if (!twitchGateEnabled) {
      return;
    }

    const controller = new AbortController();

    void fetchTwitchGateStatus(controller.signal)
      .then((status) => {
        setTwitchGateStatus(status);
        setTwitchGateError(null);
        setConfig((current) => ({
          ...current,
          unlockToken: status.entitled ? status.overlayToken ?? undefined : undefined,
        }));
      })
      .catch((fetchError) => {
        if (controller.signal.aborted) {
          return;
        }

        const message =
          fetchError instanceof Error
            ? fetchError.message
            : 'Unable to load Twitch gate status.';

        setTwitchGateError(message);
      });

    return () => controller.abort();
  }, [twitchGateEnabled]);

  useEffect(() => {
    if (twitchGateEnabled && !twitchGateStatus?.entitled) {
      setConfig((current) => ({
        ...current,
        unlockToken: undefined,
      }));
    }
  }, [twitchGateEnabled, twitchGateStatus]);

  async function copyUrl() {
    await navigator.clipboard.writeText(buildOverlayUrl(config));
    setCopied(true);
  }

  function triggerPreviewGoal(alignment: 'away' | 'home') {
    setPreviewGoalFlash({
      key: Date.now(),
      alignment,
    });
  }

  function toggleTeam(teamAbbrev: string) {
    setConfig((current) => {
      const selectedTeams = new Set(current.teams);

      if (selectedTeams.has(teamAbbrev)) {
        selectedTeams.delete(teamAbbrev);
      } else {
        selectedTeams.add(teamAbbrev);
      }

      const nextTeams = SELECTABLE_NHL_TEAMS.filter((team) =>
        selectedTeams.has(team.abbrev),
      ).map((team) => team.abbrev);

      return {
        ...current,
        mode: nextTeams.length ? 'manual' : 'auto',
        teams: nextTeams,
        gameId: undefined,
      };
    });
  }

  return (
    <main className="settings-page">
      <section className="settings-header">
        <p className="eyebrow">Live Score Overlay</p>
        <h1>Set up your score overlay</h1>
        <p className="header-copy">
          Choose the teams, look, and layout you want, then copy the link into
          OBS or any browser source.
        </p>
        <p className="version-chip" aria-label={`App version ${versionLabel}`}>
          Version {versionLabel}
        </p>
      </section>

      <section className="settings-layout">
        <div className="settings-panel">
          <div className="field">
            <span>Teams</span>
            <details className="team-picker">
              <summary className="team-picker-trigger">
                <span
                  className={`team-picker-trigger-text${config.teams.length ? '' : ' is-placeholder'}`}
                >
                  {teamPickerLabel}
                </span>
                <span className="team-picker-trigger-count">
                  {config.teams.length ? `${config.teams.length} selected` : 'Auto'}
                </span>
              </summary>
              <div className="team-picker-popover">
                <div className="team-picker-actions">
                  <p className="team-picker-copy">
                    Check one or more teams to follow.
                  </p>
                  <button
                    type="button"
                    className="team-picker-clear"
                    onClick={() =>
                      setConfig((current) => ({
                        ...current,
                        mode: 'auto',
                        teams: [],
                        gameId: undefined,
                      }))
                    }
                    disabled={!config.teams.length}
                  >
                    Clear all
                  </button>
                </div>
                <div className="team-picker-grid">
                  {SELECTABLE_NHL_TEAMS.map((team) => {
                    const checked = config.teams.includes(team.abbrev);

                    return (
                      <label
                        key={team.abbrev}
                        className={`team-option${checked ? ' is-selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTeam(team.abbrev)}
                        />
                        <div className="team-option-copy">
                          <p className="team-option-name">{team.name}</p>
                          <small className="team-option-code">{team.abbrev}</small>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </details>
            <small className="field-hint">
              {config.teams.length
                ? `Following ${config.teams.length} team${config.teams.length === 1 ? '' : 's'}. Leave every box unchecked to follow the best live or upcoming game automatically.`
                : 'Leave every box unchecked to follow the best live or upcoming game automatically.'}
            </small>
          </div>

          <label className="field">
            <span>Style</span>
            <select
              value={config.style}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  style: event.target.value as OverlayConfig['style'],
                }))
              }
            >
              {OVERLAY_STYLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small className="field-hint">{selectedStyle.description}</small>
          </label>

          <label className="field">
            <span>Layout</span>
            <select
              value={config.layout}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  layout: event.target.value as OverlayConfig['layout'],
                }))
              }
            >
              <option value="stacked">Stacked</option>
              <option value="compact">Compact</option>
            </select>
            <small className="field-hint">
              Compact keeps everything on a single line.
            </small>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={config.playoffsOnly}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  playoffsOnly: event.target.checked,
                }))
              }
            />
            <span>Playoffs only</span>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={config.showClock}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  showClock: event.target.checked,
                }))
              }
            />
            <span>Show live clock</span>
          </label>

          {canUseTestingTools ? (
            <label className="toggle">
              <input
                type="checkbox"
                checked={developerMode}
                onChange={(event) => setDeveloperMode(event.target.checked)}
              />
              <span>Show testing tools</span>
            </label>
          ) : null}

          <div className="field">
            <span>Overlay link</span>
            <textarea readOnly value={buildOverlayUrl(config)} rows={4} />
          </div>

          <button className="primary-button" onClick={() => void copyUrl()}>
            {copied ? 'Copied' : 'Copy overlay link'}
          </button>

          {loading ? <p className="helper-text">Loading current games…</p> : null}
          {error ? <p className="helper-text helper-error">{error}</p> : null}

          {twitchGateEnabled ? (
            <div className="supporter-card">
              <p className="supporter-label">Twitch Supporter Unlock</p>
              <p className="supporter-copy">
                Follow <strong>DJMoneyKey</strong> on Twitch to unlock supporter-only
                options in the future. The flag is off by default, so this stays
                dormant until you opt in.
              </p>
              {twitchGateStatus ? (
                <p className="supporter-status">
                  {twitchGateStatus.entitled
                    ? `Connected as ${twitchGateStatus.login}. Follower check passed.`
                    : twitchGateStatus.authenticated
                      ? `Connected as ${twitchGateStatus.login}, but follower check has not passed yet.`
                      : 'Not connected to Twitch.'}
                </p>
              ) : null}
              {twitchGateError ? (
                <p className="helper-text helper-error">{twitchGateError}</p>
              ) : null}
              <div className="supporter-actions">
                <a className="secondary-button" href={buildTwitchLoginUrl()}>
                  Connect Twitch
                </a>
                {twitchGateStatus?.authenticated ? (
                  <a className="ghost-link" href={buildTwitchLogoutUrl()}>
                    Sign out
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="preview-panel">
          <div className="preview-frame">
            <ScoreboardCard
              game={data.selectedGame}
              previousGame={previousGame}
              showClock={config.showClock}
              style={config.style}
              layout={config.layout}
              showCredit
              debugGoalFlash={canUseTestingTools ? previewGoalFlash : null}
              emptyLabel="No game found for this setup"
            />
          </div>
          {canUseTestingTools && developerMode ? (
            <div className="developer-card">
              <p className="developer-label">Testing Tools</p>
              <p className="developer-copy">
                Use these preview controls to test the goal animation without
                waiting for a real score change. They only affect the preview on
                this page.
              </p>
              <div className="developer-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => triggerPreviewGoal('away')}
                  disabled={!data.selectedGame}
                >
                  Test {data.selectedGame?.awayTeam.abbrev ?? 'Away'} Goal
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => triggerPreviewGoal('home')}
                  disabled={!data.selectedGame}
                >
                  Test {data.selectedGame?.homeTeam.abbrev ?? 'Home'} Goal
                </button>
              </div>
            </div>
          ) : null}
          <p className="helper-text">
            Leave every team unchecked to follow the best live or upcoming game
            automatically.
          </p>
        </div>
      </section>
    </main>
  );
}
