import { useEffect, useState } from 'react';
import { ScoreboardCard } from '../components/ScoreboardCard';
import {
  CREDIT_REVEAL_EVERY_MINUTES,
  CREDIT_REVEAL_FOR_SECONDS,
} from '../lib/credit';
import { isTwitchGateEnabled } from '../lib/features';
import { formatGameLabel } from '../lib/format';
import { OVERLAY_STYLE_OPTIONS } from '../lib/overlayStyles';
import { NHL_TEAMS } from '../lib/teams';
import {
  buildTwitchLoginUrl,
  buildTwitchLogoutUrl,
  fetchTwitchGateStatus,
  type TwitchGateStatus,
} from '../lib/twitchGate';
import { useOverlayData } from '../lib/useOverlayData';
import { buildOverlayUrl, parseConfig } from '../lib/urlState';
import type { OverlayConfig } from '../lib/types';

export function SettingsPage() {
  const twitchGateEnabled = isTwitchGateEnabled();
  const [config, setConfig] = useState<OverlayConfig>(() =>
    parseConfig(window.location.search),
  );
  const [copied, setCopied] = useState(false);
  const [twitchGateStatus, setTwitchGateStatus] = useState<TwitchGateStatus | null>(
    null,
  );
  const [twitchGateError, setTwitchGateError] = useState<string | null>(null);
  const { data, error, loading } = useOverlayData(config);
  const selectedStyle =
    OVERLAY_STYLE_OPTIONS.find((option) => option.value === config.style) ??
    OVERLAY_STYLE_OPTIONS[0];

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
          showCredit:
            status.entitled || !twitchGateEnabled ? current.showCredit : true,
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
        showCredit: true,
        unlockToken: undefined,
      }));
    }
  }, [twitchGateEnabled, twitchGateStatus]);

  async function copyUrl() {
    await navigator.clipboard.writeText(buildOverlayUrl(config));
    setCopied(true);
  }

  return (
    <main className="settings-page">
      <section className="settings-header">
        <p className="eyebrow">NHL Live Feed</p>
        <h1>Score overlay settings</h1>
        <p className="header-copy">
          Build a copy-and-paste browser source URL for Twitch, OBS, and GitHub
          Pages deployments.
        </p>
      </section>

      <section className="settings-layout">
        <div className="settings-panel">
          <label className="field">
            <span>Mode</span>
            <select
              value={config.mode}
              onChange={(event) => {
                const nextMode = event.target.value as OverlayConfig['mode'];

                setConfig((current) => ({
                  ...current,
                  mode: nextMode,
                  gameId: nextMode === 'manual' ? current.gameId : undefined,
                }));
              }}
            >
              <option value="auto">Auto</option>
              <option value="manual">Manual</option>
            </select>
          </label>

          {config.mode === 'auto' ? (
            <label className="field">
              <span>Team</span>
              <select
                value={config.team}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    team: event.target.value,
                  }))
                }
              >
                {NHL_TEAMS.map((team) => (
                  <option key={team.abbrev} value={team.abbrev}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="field">
              <span>Game</span>
              <select
                value={config.gameId ?? ''}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    gameId: event.target.value ? Number(event.target.value) : undefined,
                  }))
                }
              >
                <option value="">Select a game</option>
                {data.games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {formatGameLabel(game)}
                  </option>
                ))}
              </select>
            </label>
          )}

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
              Compact keeps the whole scorebug on a single line.
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

          <label className="toggle">
            <input
              type="checkbox"
              checked={config.showCredit}
              disabled={twitchGateEnabled && !twitchGateStatus?.entitled}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  showCredit: event.target.checked,
                }))
              }
            />
            <span>Reveal creator credit</span>
          </label>

          <div className="field">
            <span>Overlay URL</span>
            <textarea readOnly value={buildOverlayUrl(config)} rows={4} />
          </div>

          <button className="primary-button" onClick={() => void copyUrl()}>
            {copied ? 'Copied' : 'Copy overlay link'}
          </button>

          {loading ? <p className="helper-text">Loading live schedule…</p> : null}
          {error ? <p className="helper-text helper-error">{error}</p> : null}

          {twitchGateEnabled ? (
            <div className="supporter-card">
              <p className="supporter-label">Twitch Supporter Unlock</p>
              <p className="supporter-copy">
                Follow <strong>DJMoneyKey</strong> on Twitch to unlock supporter-only
                options like disabling creator credit. The flag is off by default,
                so this stays dormant until you opt in.
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
              showClock={config.showClock}
              style={config.style}
              layout={config.layout}
              showCredit={config.showCredit}
              emptyLabel="No game scheduled for this selection"
            />
          </div>
          <p className="helper-text">
            Default mode follows the schedule automatically. Leave team on
            Auto to always surface the best current or next game.
          </p>
          <div className="creator-note">
            <p className="creator-label">Created by DJMoneyKey</p>
            <p className="creator-copy">
              When enabled, the credit appears every {CREDIT_REVEAL_EVERY_MINUTES}{' '}
              minutes for about {CREDIT_REVEAL_FOR_SECONDS} seconds. In compact
              layout it shows below the scorebug; in stacked layout it swaps into
              the footer line.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
