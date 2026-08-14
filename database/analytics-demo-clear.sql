DELETE FROM analytics_daily_counters
WHERE subject_kind = 'SITE'
  AND subject_id = 'dashboard-demo-v1'
  AND event_kind IN (
    'OPEN_NOTICE_LOCATION_DETAIL_VIEW',
    'NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW'
  );
