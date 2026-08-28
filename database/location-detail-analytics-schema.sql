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
