import { useEffect, useState } from 'react';
import {
  fetchAnalyticsSummary,
  getAnalyticsSummaryUrl,
  getStoredAdminToken,
  storeAdminToken,
  type AnalyticsBreakdownEntry,
  type AnalyticsSummary,
} from '../lib/adminAnalytics';

const DAY_WINDOW_OPTIONS = [7, 14, 30, 90];

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function hasTrackedEvents(summary: AnalyticsSummary): boolean {
  return (
    summary.totals.uniqueUsers > 0 ||
    summary.totals.settingsViews > 0 ||
    summary.totals.overlayLinkCopies > 0 ||
    summary.totals.overlayLoads > 0
  );
}

function formatBreakdownLabel(groupKey: string, rawValue: string): string {
  if (groupKey === 'playoffsOnly') {
    return rawValue === '1' ? 'Playoffs only' : 'All games';
  }

  if (groupKey === 'showClock') {
    return rawValue === '1' ? 'Clock on' : 'Clock off';
  }

  if (groupKey === 'refreshSeconds') {
    return `${rawValue}s`;
  }

  if (groupKey === 'teamCount') {
    return rawValue === '0' ? 'Auto schedule' : `${rawValue} teams`;
  }

  if (groupKey === 'teams') {
    return rawValue === 'AUTO' ? 'Auto schedule' : rawValue;
  }

  if (groupKey === 'paths') {
    return rawValue === '/game-score/' ? '/game-score/' : rawValue;
  }

  return rawValue;
}

function BreakdownTable({
  entries,
  emptyLabel,
  groupKey,
  kicker,
  tone = 'settings',
  title,
}: {
  entries: AnalyticsBreakdownEntry[];
  emptyLabel: string;
  groupKey: string;
  kicker: string;
  tone?: 'audience' | 'settings';
  title: string;
}) {
  return (
    <section
      className={`admin-breakdown-card ${
        tone === 'audience' ? 'is-audience' : 'is-settings'
      }`}
    >
      <div className="admin-section-heading">
        <p className="admin-section-kicker">{kicker}</p>
        <h3>{title}</h3>
      </div>
      {entries.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Value</th>
                <th>Users</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={`${groupKey}-${entry.value}`}>
                  <td>{formatBreakdownLabel(groupKey, entry.value)}</td>
                  <td>{formatNumber(entry.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="helper-text">{emptyLabel}</p>
      )}
    </section>
  );
}

export function AdminPage() {
  const [tokenInput, setTokenInput] = useState(() => getStoredAdminToken());
  const [activeToken, setActiveToken] = useState(() => getStoredAdminToken());
  const [windowDays, setWindowDays] = useState(30);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const summaryUrl = getAnalyticsSummaryUrl(windowDays);

  useEffect(() => {
    if (!activeToken) {
      setSummary(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void fetchAnalyticsSummary(activeToken, windowDays, controller.signal)
      .then((nextSummary) => {
        setSummary(nextSummary);
        setLastUpdated(new Date().toLocaleString());
        setError(null);
      })
      .catch((fetchError) => {
        if (controller.signal.aborted) {
          return;
        }

        setSummary(null);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Unable to load analytics.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [activeToken, refreshNonce, windowDays]);

  function saveToken() {
    const normalizedToken = tokenInput.trim();
    storeAdminToken(normalizedToken);
    setActiveToken(normalizedToken);
    setRefreshNonce((currentValue) => currentValue + 1);
  }

  function clearToken() {
    storeAdminToken('');
    setTokenInput('');
    setActiveToken('');
    setSummary(null);
    setError(null);
    setLastUpdated(null);
  }

  function refreshSummary() {
    setRefreshNonce((currentValue) => currentValue + 1);
  }

  return (
    <main className="admin-page">
      <section className="admin-hero">
        <p className="eyebrow">Private Analytics</p>
        <h1>Admin dashboard</h1>
        <p className="header-copy admin-hero-copy">
          This page reads the protected analytics summary from your Worker. The
          bearer token stays in your browser and is never bundled into the public
          app.
        </p>
      </section>

      <section className="admin-shell">
        <div className="admin-auth-panel">
          <div className="admin-section-heading">
            <p className="admin-section-kicker">Access</p>
            <h2>Analytics token</h2>
          </div>

          <div className="field">
            <span>Read token</span>
            <input
              className="admin-input"
              type="password"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              placeholder="Paste ANALYTICS_READ_TOKEN"
              autoComplete="current-password"
            />
            <p className="field-hint">
              Stored only in this browser so you can reopen the dashboard without
              typing it each time.
            </p>
          </div>

          <div className="admin-toolbar">
            <button className="primary-button" type="button" onClick={saveToken}>
              Save token
            </button>
            <button className="secondary-button" type="button" onClick={clearToken}>
              Clear token
            </button>
          </div>

          <div className="field">
            <div className="field-header">
              <span>Window</span>
              <span className="field-value">{windowDays} days</span>
            </div>
            <select
              value={windowDays}
              onChange={(event) => setWindowDays(Number(event.target.value))}
              className="admin-select"
            >
              {DAY_WINDOW_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  Last {option} days
                </option>
              ))}
            </select>
          </div>

          <div className="admin-status-card">
            <p className="supporter-label">Status</p>
            <p className="supporter-status">
              {activeToken
                ? loading
                  ? 'Loading analytics from the Worker.'
                  : 'Token loaded. Dashboard can query the summary endpoint.'
                : 'No token loaded yet.'}
            </p>
            {lastUpdated ? (
              <p className="helper-text">Last updated: {lastUpdated}</p>
            ) : null}
            {error ? <p className="helper-text helper-error">{error}</p> : null}
            <p className="helper-text">
              Summary endpoint: <code>{summaryUrl}</code>
            </p>
            <p className="helper-text">
              Privacy note: this dashboard stores country, city, timezone, browser,
              platform, and network organization for aggregate reporting. Raw IP
              addresses are not stored.
            </p>
            <div className="admin-toolbar">
              <button
                className="secondary-button"
                type="button"
                onClick={refreshSummary}
                disabled={!activeToken || loading}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="admin-content-panel">
          {summary ? (
            <>
              {!hasTrackedEvents(summary) ? (
                <section className="admin-empty-state">
                  <div className="admin-section-heading">
                    <p className="admin-section-kicker">Summary</p>
                    <h2>Worker connected, but no events yet</h2>
                  </div>
                  <p className="helper-text">
                    The admin token worked and the summary endpoint responded, but
                    there are no recorded analytics rows in the selected window.
                  </p>
                  <p className="helper-text">
                    Open the settings page from the same deployment, copy an overlay
                    link, then load that overlay URL once in a browser or OBS. The
                    admin page itself does not generate analytics events.
                  </p>
                </section>
              ) : null}

              <section className="admin-group-panel is-overview">
                <div className="admin-section-heading">
                  <p className="admin-section-kicker">Overview</p>
                  <h2>Usage snapshot</h2>
                  <p className="admin-section-copy">
                    Start here for the quick read: how many installs reached the
                    app, how many copied an overlay link, and how many actually
                    loaded it.
                  </p>
                </div>

                <div className="admin-metric-groups">
                  <section className="admin-metric-group">
                    <p className="admin-metric-kicker">Users</p>
                    <h3 className="admin-metric-group-title">Reach</h3>
                    <p className="admin-metric-group-copy">
                      Distinct installs that touched the settings page or made it
                      through to an overlay load in the selected window.
                    </p>
                    <div className="admin-totals-grid">
                      <article className="admin-total-card">
                        <p className="admin-total-label">Unique users</p>
                        <p className="admin-total-value">
                          {formatNumber(summary.totals.uniqueUsers)}
                        </p>
                      </article>
                      <article className="admin-total-card">
                        <p className="admin-total-label">Settings users</p>
                        <p className="admin-total-value">
                          {formatNumber(summary.totals.settingsUsers)}
                        </p>
                      </article>
                      <article className="admin-total-card">
                        <p className="admin-total-label">Overlay users</p>
                        <p className="admin-total-value">
                          {formatNumber(summary.totals.overlayUsers)}
                        </p>
                      </article>
                    </div>
                  </section>

                  <section className="admin-metric-group">
                    <p className="admin-metric-kicker">Actions</p>
                    <h3 className="admin-metric-group-title">Engagement</h3>
                    <p className="admin-metric-group-copy">
                      These counts show what people actually did after opening the
                      app: view settings, copy a URL, and load the overlay.
                    </p>
                    <div className="admin-totals-grid">
                      <article className="admin-total-card">
                        <p className="admin-total-label">Settings views</p>
                        <p className="admin-total-value">
                          {formatNumber(summary.totals.settingsViews)}
                        </p>
                      </article>
                      <article className="admin-total-card">
                        <p className="admin-total-label">Link copies</p>
                        <p className="admin-total-value">
                          {formatNumber(summary.totals.overlayLinkCopies)}
                        </p>
                      </article>
                      <article className="admin-total-card">
                        <p className="admin-total-label">Overlay loads</p>
                        <p className="admin-total-value">
                          {formatNumber(summary.totals.overlayLoads)}
                        </p>
                      </article>
                    </div>
                  </section>
                </div>
              </section>

              <section className="admin-group-panel is-activity">
                <div className="admin-section-heading">
                  <p className="admin-section-kicker">Activity</p>
                  <h2>Daily trend</h2>
                  <p className="admin-section-copy">
                    Use this table to spot whether usage is growing, flat, or tied
                    to specific stream days.
                  </p>
                </div>
                {summary.daily.length ? (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Day</th>
                          <th>Unique users</th>
                          <th>Overlay loads</th>
                          <th>Link copies</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.daily.map((entry) => (
                          <tr key={entry.day}>
                            <td>{entry.day}</td>
                            <td>{formatNumber(entry.uniqueUsers)}</td>
                            <td>{formatNumber(entry.overlayLoads)}</td>
                            <td>{formatNumber(entry.overlayLinkCopies)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="helper-text">
                    No analytics events found in the selected window.
                  </p>
                )}
              </section>

              <section className="admin-group-panel is-analytics">
                <div className="admin-section-heading">
                  <p className="admin-section-kicker">Audience</p>
                  <h2>User analytics</h2>
                  <p className="admin-section-copy">
                    Aggregate viewer environment data captured by the Worker:
                    geography, platform, browser family, and network organization.
                  </p>
                </div>
                <section className="admin-breakdown-grid">
                  <BreakdownTable
                    entries={summary.audience.countries}
                    emptyLabel="No country data yet."
                    groupKey="countries"
                    kicker="Audience"
                    title="Countries"
                    tone="audience"
                  />
                  <BreakdownTable
                    entries={summary.audience.regions}
                    emptyLabel="No region data yet."
                    groupKey="regions"
                    kicker="Audience"
                    title="Regions"
                    tone="audience"
                  />
                  <BreakdownTable
                    entries={summary.audience.cities}
                    emptyLabel="No city data yet."
                    groupKey="cities"
                    kicker="Audience"
                    title="Cities"
                    tone="audience"
                  />
                  <BreakdownTable
                    entries={summary.audience.timezones}
                    emptyLabel="No timezone data yet."
                    groupKey="timezones"
                    kicker="Audience"
                    title="Timezones"
                    tone="audience"
                  />
                  <BreakdownTable
                    entries={summary.audience.browsers}
                    emptyLabel="No browser data yet."
                    groupKey="browsers"
                    kicker="Audience"
                    title="Browsers"
                    tone="audience"
                  />
                  <BreakdownTable
                    entries={summary.audience.platforms}
                    emptyLabel="No platform data yet."
                    groupKey="platforms"
                    kicker="Audience"
                    title="Platforms"
                    tone="audience"
                  />
                  <BreakdownTable
                    entries={summary.audience.networks}
                    emptyLabel="No network data yet."
                    groupKey="networks"
                    kicker="Audience"
                    title="Network organizations"
                    tone="audience"
                  />
                </section>
              </section>

              <section className="admin-group-panel is-settings">
                <div className="admin-section-heading">
                  <p className="admin-section-kicker">Configuration</p>
                  <h2>User settings</h2>
                  <p className="admin-section-copy">
                    These breakdowns show the latest saved overlay preferences per
                    install, so you can see which setups people actually prefer.
                  </p>
                </div>
                <section className="admin-breakdown-grid">
                  <BreakdownTable
                    entries={summary.settings.style}
                    emptyLabel="No style selections yet."
                    groupKey="style"
                    kicker="Settings"
                    title="Style"
                  />
                  <BreakdownTable
                    entries={summary.settings.layout}
                    emptyLabel="No layout selections yet."
                    groupKey="layout"
                    kicker="Settings"
                    title="Layout"
                  />
                  <BreakdownTable
                    entries={summary.settings.mode}
                    emptyLabel="No mode selections yet."
                    groupKey="mode"
                    kicker="Settings"
                    title="Mode"
                  />
                  <BreakdownTable
                    entries={summary.settings.refreshSeconds}
                    emptyLabel="No refresh settings yet."
                    groupKey="refreshSeconds"
                    kicker="Settings"
                    title="Refresh interval"
                  />
                  <BreakdownTable
                    entries={summary.settings.playoffsOnly}
                    emptyLabel="No playoffs settings yet."
                    groupKey="playoffsOnly"
                    kicker="Settings"
                    title="Playoffs filter"
                  />
                  <BreakdownTable
                    entries={summary.settings.showClock}
                    emptyLabel="No clock settings yet."
                    groupKey="showClock"
                    kicker="Settings"
                    title="Clock"
                  />
                  <BreakdownTable
                    entries={summary.settings.teamCount}
                    emptyLabel="No team count settings yet."
                    groupKey="teamCount"
                    kicker="Settings"
                    title="Team count"
                  />
                  <BreakdownTable
                    entries={summary.settings.teams}
                    emptyLabel="No team selections yet."
                    groupKey="teams"
                    kicker="Settings"
                    title="Team selection"
                  />
                  <BreakdownTable
                    entries={summary.settings.paths}
                    emptyLabel="No paths recorded yet."
                    groupKey="paths"
                    kicker="Settings"
                    title="Entry path"
                  />
                </section>
              </section>
            </>
          ) : (
            <section className="admin-empty-state">
              <div className="admin-section-heading">
                <p className="admin-section-kicker">Summary</p>
                <h2>Stats will appear here</h2>
              </div>
              {!activeToken ? (
                <p className="helper-text">
                  Load your analytics token to query the protected Worker endpoint.
                </p>
              ) : loading ? (
                <p className="helper-text">
                  Querying the Worker summary endpoint now.
                </p>
              ) : error ? (
                <>
                  <p className="helper-text">
                    The dashboard could not load analytics from the Worker.
                  </p>
                  <p className="helper-text">
                    Check that `VITE_API_BASE_URL` points to your deployed Worker,
                    `ANALYTICS_DB` is bound, the D1 schema has been applied, and
                    `ANALYTICS_READ_TOKEN` matches the deployed secret.
                  </p>
                </>
              ) : (
                <p className="helper-text">
                  Save your token to load the current analytics summary.
                </p>
              )}
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
