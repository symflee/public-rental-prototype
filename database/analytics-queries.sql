-- 기본 기간은 최근 30일입니다. 사용자 지정 기간은 DATE '2026-07-01'처럼 수정합니다.
-- 지도 조회수, 실제 공고 열람 클릭 수, 미연결 확인 의향 클릭 수, 총 행동 수와 행동률
WITH selected_range AS (
  SELECT CURRENT_DATE - INTERVAL '29 days' AS from_date, CURRENT_DATE AS to_date
)
SELECT
  COALESCE(SUM(total) FILTER (WHERE event_kind = 'PAGE_VIEW'), 0) AS page_view_count,
  COALESCE(SUM(total) FILTER (WHERE event_kind = 'ANNOUNCEMENT_OPEN'), 0) AS announcement_open_count,
  COALESCE(SUM(total) FILTER (WHERE event_kind = 'ANNOUNCEMENT_INTEREST'), 0) AS announcement_interest_count,
  COALESCE(SUM(total) FILTER (WHERE event_kind IN ('ANNOUNCEMENT_OPEN', 'ANNOUNCEMENT_INTEREST')), 0) AS announcement_action_count,
  COALESCE(
    ROUND(
      100.0 * SUM(total) FILTER (WHERE event_kind IN ('ANNOUNCEMENT_OPEN', 'ANNOUNCEMENT_INTEREST'))
      / NULLIF(SUM(total) FILTER (WHERE event_kind = 'PAGE_VIEW'), 0),
      1
    ),
    0
  ) AS announcement_action_rate_percent
FROM analytics_daily_counters
CROSS JOIN selected_range
WHERE metric_date BETWEEN selected_range.from_date AND selected_range.to_date;

-- 공고별 실제 열람 클릭 횟수
WITH selected_range AS (
  SELECT CURRENT_DATE - INTERVAL '29 days' AS from_date, CURRENT_DATE AS to_date
)
SELECT subject_id AS announcement_id, SUM(total) AS announcement_open_count
FROM analytics_daily_counters
CROSS JOIN selected_range
WHERE metric_date BETWEEN selected_range.from_date AND selected_range.to_date
  AND event_kind = 'ANNOUNCEMENT_OPEN'
GROUP BY subject_id
ORDER BY announcement_open_count DESC, announcement_id ASC;

-- 단지별 미연결 공고 확인 의향 클릭 횟수
WITH selected_range AS (
  SELECT CURRENT_DATE - INTERVAL '29 days' AS from_date, CURRENT_DATE AS to_date
)
SELECT subject_id AS location_id, SUM(total) AS announcement_interest_count
FROM analytics_daily_counters
CROSS JOIN selected_range
WHERE metric_date BETWEEN selected_range.from_date AND selected_range.to_date
  AND event_kind = 'ANNOUNCEMENT_INTEREST'
GROUP BY subject_id
ORDER BY announcement_interest_count DESC, location_id ASC;

-- 전체 주택 정보 조회수, 공고 중이 아닌 주택 조회수와 비율
WITH selected_range AS (
  SELECT CURRENT_DATE - INTERVAL '29 days' AS from_date, CURRENT_DATE AS to_date
),
detail_view_counts AS (
  SELECT
    COALESCE(SUM(total) FILTER (
      WHERE event_kind IN (
        'OPEN_NOTICE_LOCATION_DETAIL_VIEW',
        'NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW'
      )
    ), 0) AS location_detail_view_count,
    COALESCE(SUM(total) FILTER (
      WHERE event_kind = 'NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW'
    ), 0) AS no_open_notice_location_detail_view_count
  FROM analytics_daily_counters
  CROSS JOIN selected_range
  WHERE metric_date BETWEEN selected_range.from_date AND selected_range.to_date
)
SELECT
  location_detail_view_count,
  no_open_notice_location_detail_view_count,
  COALESCE(
    ROUND(
      100.0 * no_open_notice_location_detail_view_count
      / NULLIF(location_detail_view_count, 0),
      1
    ),
    0
  ) AS no_open_notice_location_detail_view_rate_percent
FROM detail_view_counts;
