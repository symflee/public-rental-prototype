import { expect, test } from "vitest";

import { isAnalyticsAdministrator } from "./analytics-admin-auth";

const CREDENTIALS = { password: "secret", username: "admin" };

test("HTTP Basic 인증의 일치하는 관리자만 허용한다", () => {
  const header = `Basic ${btoa("admin:secret")}`;

  expect(isAnalyticsAdministrator(header, CREDENTIALS)).toBe(true);
  expect(isAnalyticsAdministrator(`Basic ${btoa("admin:wrong")}`, CREDENTIALS)).toBe(false);
  expect(isAnalyticsAdministrator(null, CREDENTIALS)).toBe(false);
});
