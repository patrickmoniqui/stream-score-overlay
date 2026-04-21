CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_at INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  install_id TEXT NOT NULL,
  pathname TEXT NOT NULL,
  app_version TEXT,
  build_number TEXT,
  mode TEXT NOT NULL,
  style TEXT NOT NULL,
  layout TEXT NOT NULL,
  refresh_seconds INTEGER NOT NULL,
  playoffs_only INTEGER NOT NULL,
  show_clock INTEGER NOT NULL,
  team_count INTEGER NOT NULL,
  teams_key TEXT NOT NULL,
  has_unlock INTEGER NOT NULL,
  country TEXT NOT NULL DEFAULT 'Unknown country',
  region TEXT NOT NULL DEFAULT 'Unknown region',
  city TEXT NOT NULL DEFAULT 'Unknown city',
  timezone TEXT NOT NULL DEFAULT 'Unknown timezone',
  as_organization TEXT NOT NULL DEFAULT 'Unknown network',
  browser_family TEXT NOT NULL DEFAULT 'Unknown',
  platform TEXT NOT NULL DEFAULT 'Unknown'
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_recorded_at
  ON analytics_events(recorded_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_install_id
  ON analytics_events(install_id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type
  ON analytics_events(event_type);

CREATE INDEX IF NOT EXISTS idx_analytics_events_country
  ON analytics_events(country);

CREATE INDEX IF NOT EXISTS idx_analytics_events_browser_family
  ON analytics_events(browser_family);

CREATE INDEX IF NOT EXISTS idx_analytics_events_platform
  ON analytics_events(platform);
