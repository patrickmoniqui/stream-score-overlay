import { useEffect, useState } from 'react';
import { ScoreboardCard } from '../components/ScoreboardCard';
import { formatGameLabel } from '../lib/format';
import { NHL_TEAMS } from '../lib/teams';
import { useOverlayData } from '../lib/useOverlayData';
import { buildOverlayUrl, parseConfig } from '../lib/urlState';
import type { OverlayConfig } from '../lib/types';

export function SettingsPage() {
  const [config, setConfig] = useState<OverlayConfig>(() =>
    parseConfig(window.location.search),
  );
  const [copied, setCopied] = useState(false);
  const { data, error, loading } = useOverlayData(config);

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

          <div className="field">
            <span>Overlay URL</span>
            <textarea readOnly value={buildOverlayUrl(config)} rows={4} />
          </div>

          <button className="primary-button" onClick={() => void copyUrl()}>
            {copied ? 'Copied' : 'Copy overlay link'}
          </button>

          {loading ? <p className="helper-text">Loading live schedule…</p> : null}
          {error ? <p className="helper-text helper-error">{error}</p> : null}
        </div>

        <div className="preview-panel">
          <div className="preview-frame">
            <ScoreboardCard
              game={data.selectedGame}
              showClock={config.showClock}
              emptyLabel="No game scheduled for this selection"
            />
          </div>
          <p className="helper-text">
            Default mode follows the schedule automatically. Leave team on
            Auto to always surface the best current or next game.
          </p>
        </div>
      </section>
    </main>
  );
}

