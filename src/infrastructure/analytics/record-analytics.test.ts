import { afterEach, expect, test, vi } from "vitest";

import { recordAnalyticsSafely } from "./record-analytics";

afterEach(() => vi.restoreAllMocks());

test("분석 저장 성공 여부를 호출자에게 돌려준다", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

  await expect(recordAnalyticsSafely(async () => undefined)).resolves.toBe(true);
  await expect(recordAnalyticsSafely(async () => Promise.reject(new Error()))).resolves.toBe(false);
  expect(error).toHaveBeenCalledWith("분석 이벤트 기록에 실패했습니다.");
});
