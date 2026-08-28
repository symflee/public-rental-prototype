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

CREATE TABLE IF NOT EXISTS analytics_runs (
  dataset_id text PRIMARY KEY,
  label text NOT NULL,
  period_starts_on date NOT NULL,
  period_ends_on date NOT NULL,
  reference_time timestamptz NOT NULL,
  origin text NOT NULL CHECK (
    origin IN ('LIVE', 'RETROSPECTIVE_RECONSTRUCTION')
  ),
  status text NOT NULL CHECK (status IN ('DRAFT', 'FROZEN')),
  created_at timestamptz NOT NULL DEFAULT now(),
  frozen_at timestamptz,
  CHECK (period_starts_on <= period_ends_on)
);

CREATE TABLE IF NOT EXISTS analytics_location_detail_views (
  event_id uuid PRIMARY KEY,
  dataset_id text NOT NULL,
  metric_date date NOT NULL,
  viewed_at timestamptz NOT NULL,
  location_id text NOT NULL,
  notice_state text NOT NULL CHECK (
    notice_state IN ('OPEN', 'NO_OPEN', 'UNKNOWN')
  ),
  matched_notice_id text,
  status_source text NOT NULL CHECK (
    status_source IN (
      'AUTOMATED_IMPORT',
      'MANUAL_REVIEW',
      'SNAPSHOT_ABSENCE',
      'UNKNOWN'
    )
  ),
  origin text NOT NULL CHECK (
    origin IN ('LIVE', 'RETROSPECTIVE_RECONSTRUCTION')
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_location_detail_views_dataset_date_index
ON analytics_location_detail_views (dataset_id, metric_date);

CREATE INDEX IF NOT EXISTS analytics_location_detail_views_location_index
ON analytics_location_detail_views (location_id, viewed_at);

CREATE TABLE IF NOT EXISTS public_rental_manual_recruitment_notices (
  notice_id text PRIMARY KEY CHECK (
    char_length(notice_id) BETWEEN 1 AND 64
  ),
  title text NOT NULL CHECK (
    char_length(title) BETWEEN 1 AND 300
  ),
  url text NOT NULL CHECK (
    url ~ '^https://apply[.]lh[.]or[.]kr([/?#]|$)'
  ),
  announced_at date NOT NULL,
  application_starts_at timestamptz NOT NULL,
  application_ends_at timestamptz NOT NULL,
  source_kind text NOT NULL CHECK (
    source_kind IN ('AUTOMATED_IMPORT', 'MANUAL_REVIEW')
  ),
  evidence_url text NOT NULL CHECK (
    evidence_url ~ '^https://apply[.]lh[.]or[.]kr([/?#]|$)'
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT public_rental_manual_recruitment_period_check CHECK (
    application_starts_at <= application_ends_at
  )
);

CREATE TABLE IF NOT EXISTS public_rental_manual_recruitment_locations (
  notice_id text NOT NULL REFERENCES public_rental_manual_recruitment_notices (notice_id),
  location_id text NOT NULL CHECK (
    char_length(location_id) BETWEEN 1 AND 200
  ),
  PRIMARY KEY (notice_id, location_id)
);

CREATE INDEX IF NOT EXISTS public_rental_manual_recruitment_active_index
ON public_rental_manual_recruitment_notices (application_starts_at, application_ends_at)
WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS public_rental_manual_recruitment_location_index
ON public_rental_manual_recruitment_locations (location_id);
