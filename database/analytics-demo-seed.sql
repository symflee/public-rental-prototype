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
    ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date - 3, 'OPEN_NOTICE_LOCATION_DETAIL_VIEW', 80),
    ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date - 3, 'NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW', 88),
    ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date - 2, 'OPEN_NOTICE_LOCATION_DETAIL_VIEW', 85),
    ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date - 2, 'NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW', 94),
    ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date - 1, 'OPEN_NOTICE_LOCATION_DETAIL_VIEW', 87),
    ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date - 1, 'NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW', 99),
    ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date, 'OPEN_NOTICE_LOCATION_DETAIL_VIEW', 92),
    ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date, 'NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW', 107)
)
INSERT INTO analytics_daily_counters (
  metric_date, event_kind, subject_kind, subject_id, total
)
SELECT seeded_counters.metric_date, seeded_counters.event_kind,
  'SITE', 'dashboard-demo-v1', seeded_counters.total
FROM seeded_counters
CROSS JOIN (SELECT COUNT(*) AS deleted_total FROM deleted_demo) AS deletion
WHERE deletion.deleted_total >= 0;
