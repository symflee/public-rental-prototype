CREATE TABLE IF NOT EXISTS analytics_daily_counters (
  metric_date date NOT NULL,
  event_kind text NOT NULL,
  subject_kind text NOT NULL CHECK (
    subject_kind IN ('SITE', 'ANNOUNCEMENT', 'LOCATION')
  ),
  subject_id text NOT NULL,
  total bigint NOT NULL DEFAULT 0 CHECK (total >= 0),
  PRIMARY KEY (metric_date, event_kind, subject_kind, subject_id),
  CONSTRAINT analytics_daily_counters_event_kind_check CHECK (
    event_kind IN (
      'PAGE_VIEW',
      'ANNOUNCEMENT_OPEN',
      'ANNOUNCEMENT_INTEREST',
      'OPEN_NOTICE_LOCATION_DETAIL_VIEW',
      'NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW'
    )
  )
);

ALTER TABLE analytics_daily_counters
  DROP CONSTRAINT IF EXISTS analytics_daily_counters_event_kind_check,
  ADD CONSTRAINT analytics_daily_counters_event_kind_check CHECK (
    event_kind IN (
      'PAGE_VIEW',
      'ANNOUNCEMENT_OPEN',
      'ANNOUNCEMENT_INTEREST',
      'OPEN_NOTICE_LOCATION_DETAIL_VIEW',
      'NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW'
    )
  );

CREATE INDEX IF NOT EXISTS analytics_daily_counters_date_index
ON analytics_daily_counters (metric_date);

CREATE TABLE IF NOT EXISTS analytics_experiment_events (
  event_id uuid PRIMARY KEY,
  metric_date date NOT NULL,
  experiment_key text NOT NULL,
  variant text NOT NULL CHECK (
    variant IN ('OPEN_NOTICES_ONLY', 'ALL_HOMES')
  ),
  visitor_hash text NOT NULL,
  event_kind text NOT NULL CHECK (
    event_kind IN (
      'EXPERIMENT_ELIGIBLE',
      'NO_OPEN_NOTICE_LOCATION_VIEWED',
      'BOOKMARK_ADDED',
      'BOOKMARK_REMOVED',
      'OPEN_ANNOUNCEMENT_VIEWED'
    )
  ),
  subject_kind text NOT NULL CHECK (
    subject_kind IN ('SITE', 'LOCATION')
  ),
  subject_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_experiment_events_date_index
ON analytics_experiment_events (metric_date);

CREATE TABLE IF NOT EXISTS analytics_experiment_facts (
  metric_date date NOT NULL,
  experiment_key text NOT NULL,
  variant text NOT NULL CHECK (
    variant IN ('OPEN_NOTICES_ONLY', 'ALL_HOMES')
  ),
  visitor_hash text NOT NULL,
  event_kind text NOT NULL CHECK (
    event_kind IN (
      'EXPERIMENT_ELIGIBLE',
      'NO_OPEN_NOTICE_LOCATION_VIEWED',
      'BOOKMARK_ADDED',
      'BOOKMARK_REMOVED',
      'OPEN_ANNOUNCEMENT_VIEWED'
    )
  ),
  subject_kind text NOT NULL CHECK (
    subject_kind IN ('SITE', 'LOCATION')
  ),
  subject_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (
    metric_date,
    experiment_key,
    variant,
    visitor_hash,
    event_kind,
    subject_kind,
    subject_id
  )
);

CREATE INDEX IF NOT EXISTS analytics_experiment_facts_date_key_index
ON analytics_experiment_facts (metric_date, experiment_key);
