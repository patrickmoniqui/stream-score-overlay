import { useEffect, useRef, useState } from 'react';
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
import {
  buildTrackedOverlayUrl,
  getAnalyticsInstallId,
  trackAnalyticsEvent,
} from '../lib/analytics';
import { findPreviousFinalGame } from '../lib/gameSelection';
import { useOverlayData } from '../lib/useOverlayData';
import {
  MAX_REFRESH_SECONDS,
  MIN_REFRESH_SECONDS,
  buildOverlayUrl,
  parseConfig,
} from '../lib/urlState';
import type { OverlayConfig } from '../lib/types';

const SELECTABLE_NHL_TEAMS = NHL_TEAMS.filter((team) => team.abbrev !== 'AUTO');
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function TwitchSocialIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M4 3h16v11l-4 4h-4l-2 3H7v-3H4V3zm2 2v11h3v2l2-2h4l3-3V5H6zm4 3h2v4h-2V8zm5 0h2v4h-2V8z"
      />
    </svg>
  );
}

function InstagramSocialIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.8A3.95 3.95 0 0 0 3.8 7.75v8.5A3.95 3.95 0 0 0 7.75 20.2h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95h-8.5zm8.95 1.35a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2zM12 6.8A5.2 5.2 0 1 1 6.8 12 5.2 5.2 0 0 1 12 6.8zm0 1.8A3.4 3.4 0 1 0 15.4 12 3.4 3.4 0 0 0 12 8.6z"
      />
    </svg>
  );
}

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
  const [installId] = useState(() => getAnalyticsInstallId());
  const [developerMode, setDeveloperMode] = useState(false);
  const [previewGoalFlash, setPreviewGoalFlash] = useState<{
    key: number;
    alignment: 'away' | 'home';
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [twitchGateStatus, setTwitchGateStatus] = useState<TwitchGateStatus | null>(
    null,
  );
  const [twitchGateError, setTwitchGateError] = useState<string | null>(null);
  const overlayLinkRef = useRef<HTMLTextAreaElement | null>(null);
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
  const trackedOverlayUrl = buildTrackedOverlayUrl(config, installId);

  useEffect(() => {
    const nextSearch = new URL(buildOverlayUrl(config)).search;
    window.history.replaceState({}, '', `${window.location.pathname}${nextSearch}`);
  }, [config]);

  useEffect(() => {
    void trackAnalyticsEvent('settings_opened', config, { installId });
  }, [installId]);

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
    setCopyError(null);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(trackedOverlayUrl);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      const overlayLinkField = overlayLinkRef.current;

      if (overlayLinkField) {
        overlayLinkField.focus();
        overlayLinkField.select();
        overlayLinkField.setSelectionRange(0, overlayLinkField.value.length);

        if (document.execCommand('copy')) {
          void trackAnalyticsEvent('overlay_link_copied', config, { installId });
          setCopied(true);
          return;
        }
      }

      setCopyError(
        'Clipboard access was blocked. The overlay link is highlighted so you can copy it manually.',
      );
      return;
    }

    void trackAnalyticsEvent('overlay_link_copied', config, { installId });
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
        <div className="header-meta">
          <p className="version-chip" aria-label={`App version ${versionLabel}`}>
            Version {versionLabel}
          </p>
          <div className="social-follow-links" aria-label="Follow DJ MoneyKey">
          <a
            className="social-follow-link"
            href="https://www.twitch.tv/djmoneykey"
            target="_blank"
            rel="noreferrer"
          >
            <span className="social-follow-icon">
              <TwitchSocialIcon />
            </span>
            <span>Twitch</span>
          </a>
          <a
            className="social-follow-link"
            href="http://instagram.com/dj_moneykey"
            target="_blank"
            rel="noreferrer"
          >
            <span className="social-follow-icon">
              <InstagramSocialIcon />
            </span>
            <span>Instagram</span>
          </a>
          </div>
        </div>
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

          <div className="field">
            <div className="field-header">
              <span>Refresh</span>
              <span className="field-value">{config.refreshSeconds}s</span>
            </div>
            <input
              className="range-input"
              type="range"
              min={String(MIN_REFRESH_SECONDS)}
              max={String(MAX_REFRESH_SECONDS)}
              step="1"
              value={config.refreshSeconds}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  refreshSeconds: Number(event.target.value),
                }))
              }
            />
            <small className="field-hint">
              Controls how often the overlay checks for score updates. The minimum
              is {MIN_REFRESH_SECONDS}s to protect the Worker request budget.
            </small>
          </div>

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

          <label className="toggle">
            <input
              type="checkbox"
              checked={config.muted}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  muted: event.target.checked,
                }))
              }
            />
            <span>Mute</span>
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
            <textarea
              ref={overlayLinkRef}
              readOnly
              value={trackedOverlayUrl}
              rows={4}
            />
          </div>

          <button
            className="primary-button"
            type="button"
            onClick={() => void copyUrl()}
          >
            {copied ? 'Copied' : 'Copy overlay link'}
          </button>
          {copyError ? <p className="helper-text helper-error">{copyError}</p> : null}

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
              muted={config.muted}
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
                Use these preview controls to test the goal animation and horn
                without waiting for a real score change. They only affect the
                preview on this page.
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

      <footer className="settings-footer">
        <p>Made with ❤️ in Montreal by DJMoneykey</p>
      </footer>
    </main>
  );
}
