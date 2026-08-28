WITH deleted_demo AS (
  DELETE FROM analytics_daily_counters
  WHERE subject_kind = 'SITE'
    AND subject_id = 'dashboard-demo-v1'
    AND event_kind IN (
      'OPEN_NOTICE_LOCATION_DETAIL_VIEW',
      'NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW'
    )
  RETURNING 1
), seeded_counters (metric_date, event_kind, total) AS (
  VALUES
    ('2026-08-11'::date, 'OPEN_NOTICE_LOCATION_DETAIL_VIEW', 22),
    ('2026-08-11'::date, 'NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW', 10),
    ('2026-08-12'::date, 'OPEN_NOTICE_LOCATION_DETAIL_VIEW', 24),
    ('2026-08-12'::date, 'NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW', 12),
    ('2026-08-13'::date, 'OPEN_NOTICE_LOCATION_DETAIL_VIEW', 21),
    ('2026-08-13'::date, 'NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW', 14),
    ('2026-08-14'::date, 'OPEN_NOTICE_LOCATION_DETAIL_VIEW', 13),
    ('2026-08-14'::date, 'NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW', 16)
)
INSERT INTO analytics_daily_counters (
  metric_date, event_kind, subject_kind, subject_id, total
)
SELECT seeded_counters.metric_date, seeded_counters.event_kind,
  'SITE', 'dashboard-demo-v1', seeded_counters.total
FROM seeded_counters
CROSS JOIN (SELECT COUNT(*) AS deleted_total FROM deleted_demo) AS deletion
WHERE deletion.deleted_total >= 0;
