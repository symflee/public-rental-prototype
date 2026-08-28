import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "vitest";

import { RECRUITMENT_ALERT_SCHEMA_STATEMENTS } from "./recruitment-alert-schema";

test("다음 공고 1회 알림과 활성 신청 중복 방지 스키마를 정의한다", () => {
  const schemaPath = join(process.cwd(), "database/recruitment-alert-schema.sql");
  const schema = readFileSync(schemaPath, "utf8");

  expect(schema).toContain("public_rental_notice_email_subscriptions");
  expect(schema).toContain("location_name_snapshot");
  expect(schema).toContain("email_normalized");
  expect(schema).toContain("consent_version");
  expect(schema).toContain("expires_at");
  expect(schema).toContain("notified_notice_id");
  expect(schema).toContain("(notified_at IS NULL) = (notified_notice_id IS NULL)");
  expect(schema).toContain("(location_id, email_normalized)");
  expect(schema).toContain("WHERE notified_at IS NULL");
  expect(RECRUITMENT_ALERT_SCHEMA_STATEMENTS.join(" ")).toContain(
    "public_rental_notice_email_subscriptions",
  );
});
