import { expect, test } from "vitest";

import { MANUAL_RECRUITMENT_SCHEMA_STATEMENTS } from "./manual-recruitment-schema";

test("수기 공고, 단지 연결, 철회 이력을 재실행 가능한 스키마로 만든다", () => {
  const schema = MANUAL_RECRUITMENT_SCHEMA_STATEMENTS.join(" ");

  expect(schema).toContain("CREATE TABLE IF NOT EXISTS public_rental_manual_recruitment_notices");
  expect(schema).toContain("CREATE TABLE IF NOT EXISTS public_rental_manual_recruitment_locations");
  expect(schema).toContain("application_starts_at <= application_ends_at");
  expect(schema).toContain("'AUTOMATED_IMPORT', 'MANUAL_REVIEW'");
  expect(schema).toContain("https://apply[.]lh[.]or[.]kr");
  expect(schema).toContain("revoked_at");
});
