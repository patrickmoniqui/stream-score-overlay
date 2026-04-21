ALTER TABLE analytics_events
  ADD COLUMN country TEXT NOT NULL DEFAULT 'Unknown country';

ALTER TABLE analytics_events
  ADD COLUMN region TEXT NOT NULL DEFAULT 'Unknown region';

ALTER TABLE analytics_events
  ADD COLUMN city TEXT NOT NULL DEFAULT 'Unknown city';

ALTER TABLE analytics_events
  ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Unknown timezone';

ALTER TABLE analytics_events
  ADD COLUMN as_organization TEXT NOT NULL DEFAULT 'Unknown network';

ALTER TABLE analytics_events
  ADD COLUMN browser_family TEXT NOT NULL DEFAULT 'Unknown';

ALTER TABLE analytics_events
  ADD COLUMN platform TEXT NOT NULL DEFAULT 'Unknown';

CREATE INDEX IF NOT EXISTS idx_analytics_events_country
  ON analytics_events(country);

CREATE INDEX IF NOT EXISTS idx_analytics_events_browser_family
  ON analytics_events(browser_family);

CREATE INDEX IF NOT EXISTS idx_analytics_events_platform
  ON analytics_events(platform);
