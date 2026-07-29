CREATE TABLE IF NOT EXISTS analytics_daily_counters (
  metric_date date NOT NULL,
  event_kind text NOT NULL CHECK (
    event_kind IN ('PAGE_VIEW', 'ANNOUNCEMENT_OPEN', 'ANNOUNCEMENT_INTEREST')
  ),
  subject_kind text NOT NULL CHECK (
    subject_kind IN ('SITE', 'ANNOUNCEMENT', 'LOCATION')
  ),
  subject_id text NOT NULL,
  total bigint NOT NULL DEFAULT 0 CHECK (total >= 0),
  PRIMARY KEY (metric_date, event_kind, subject_kind, subject_id)
);

CREATE INDEX IF NOT EXISTS analytics_daily_counters_date_index
ON analytics_daily_counters (metric_date);
