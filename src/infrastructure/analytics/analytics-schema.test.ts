import { expect, test } from "vitest";

import { ANALYTICS_SCHEMA_STATEMENTS } from "./analytics-schema";

test("기존 분석 테이블의 이벤트 제약을 모집 상태별 상세 조회까지 재실행 가능하게 확장한다", () => {
  const schema = ANALYTICS_SCHEMA_STATEMENTS.join(" ");

  expect(schema).toContain("OPEN_NOTICE_LOCATION_DETAIL_VIEW");
  expect(schema).toContain("NO_OPEN_NOTICE_LOCATION_DETAIL_VIEW");
  expect(schema).toContain("DROP CONSTRAINT IF EXISTS analytics_daily_counters_event_kind_check");
  expect(schema).toContain("ADD CONSTRAINT analytics_daily_counters_event_kind_check");
});
