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

-- 전체 주택 탐색 실험의 고유 방문자 퍼널과 10% 북마크 기준
WITH selected_range AS (
  SELECT CURRENT_DATE - INTERVAL '29 days' AS from_date, CURRENT_DATE AS to_date
),
selected_facts AS (
  SELECT event_kind, visitor_hash
  FROM analytics_experiment_facts
  CROSS JOIN selected_range
  WHERE metric_date BETWEEN selected_range.from_date AND selected_range.to_date
    AND experiment_key = 'whole-housing-bookmark-v1'
    AND variant = 'ALL_HOMES'
),
eligible_visitors AS (
  SELECT DISTINCT visitor_hash
  FROM selected_facts
  WHERE event_kind = 'EXPERIMENT_ELIGIBLE'
),
eligible_facts AS (
  SELECT selected_facts.event_kind, selected_facts.visitor_hash
  FROM selected_facts
  INNER JOIN eligible_visitors USING (visitor_hash)
),
visitor_counts AS (
  SELECT
    COUNT(DISTINCT visitor_hash) FILTER (
      WHERE event_kind = 'EXPERIMENT_ELIGIBLE'
    ) AS eligible_visitors,
    COUNT(DISTINCT visitor_hash) FILTER (
      WHERE event_kind = 'NO_OPEN_NOTICE_LOCATION_VIEWED'
    ) AS no_open_notice_location_viewers,
    COUNT(DISTINCT visitor_hash) FILTER (
      WHERE event_kind = 'BOOKMARK_ADDED'
    ) AS bookmark_visitors,
    COUNT(DISTINCT visitor_hash) FILTER (
      WHERE event_kind = 'OPEN_ANNOUNCEMENT_VIEWED'
    ) AS open_announcement_viewers
  FROM eligible_facts
)
SELECT
  eligible_visitors,
  no_open_notice_location_viewers,
  bookmark_visitors,
  open_announcement_viewers,
  COALESCE(
    ROUND(100.0 * no_open_notice_location_viewers / NULLIF(eligible_visitors, 0), 1),
    0
  ) AS no_open_notice_location_view_rate_percent,
  COALESCE(
    ROUND(100.0 * bookmark_visitors / NULLIF(eligible_visitors, 0), 1),
    0
  ) AS bookmark_conversion_rate_percent,
  eligible_visitors >= 253
    AND COALESCE(100.0 * bookmark_visitors / NULLIF(eligible_visitors, 0), 0) >= 10
    AS bookmark_hypothesis_validated,
  CASE
    WHEN eligible_visitors < 253 THEN 'INSUFFICIENT_SAMPLE'
    WHEN 100.0 * bookmark_visitors / NULLIF(eligible_visitors, 0) >= 10 THEN 'SUCCESS'
    ELSE 'BELOW_TARGET'
  END AS bookmark_decision_status
FROM visitor_counts;

-- 반복 추가를 포함한 비모집 주택 북마크 등록 원시 이벤트 수
WITH selected_range AS (
  SELECT CURRENT_DATE - INTERVAL '29 days' AS from_date, CURRENT_DATE AS to_date
)
SELECT COUNT(*) AS bookmark_add_count
FROM analytics_experiment_events
CROSS JOIN selected_range
WHERE metric_date BETWEEN selected_range.from_date AND selected_range.to_date
  AND experiment_key = 'whole-housing-bookmark-v1'
  AND variant = 'ALL_HOMES'
  AND event_kind = 'BOOKMARK_ADDED';

-- 공고가 연결되지 않은 위치별 고유 북마크 방문자 수
WITH selected_range AS (
  SELECT CURRENT_DATE - INTERVAL '29 days' AS from_date, CURRENT_DATE AS to_date
),
selected_facts AS (
  SELECT event_kind, subject_id, subject_kind, visitor_hash
  FROM analytics_experiment_facts
  CROSS JOIN selected_range
  WHERE metric_date BETWEEN selected_range.from_date AND selected_range.to_date
    AND experiment_key = 'whole-housing-bookmark-v1'
    AND variant = 'ALL_HOMES'
),
eligible_visitors AS (
  SELECT DISTINCT visitor_hash
  FROM selected_facts
  WHERE event_kind = 'EXPERIMENT_ELIGIBLE'
)
SELECT
  subject_id AS location_id,
  COUNT(DISTINCT visitor_hash) AS bookmark_visitors
FROM selected_facts
INNER JOIN eligible_visitors USING (visitor_hash)
WHERE event_kind = 'BOOKMARK_ADDED'
  AND subject_kind = 'LOCATION'
GROUP BY subject_id
ORDER BY bookmark_visitors DESC, location_id ASC;
