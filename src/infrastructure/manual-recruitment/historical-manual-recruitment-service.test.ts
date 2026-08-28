import { expect, test, vi } from "vitest";

import { HISTORICAL_MANUAL_RECRUITMENT_NOTICES } from "./historical-manual-recruitment-notices";
import { seedHistoricalManualRecruitmentNotices } from "./historical-manual-recruitment-service";

test("과거 공식 공고 3건을 수기 연결로 저장한다", async () => {
  const replace = vi.fn(async () => undefined);

  await seedHistoricalManualRecruitmentNotices(replace);

  expect(replace).toHaveBeenCalledTimes(3);
  expect(replace).toHaveBeenNthCalledWith(1, HISTORICAL_MANUAL_RECRUITMENT_NOTICES[0]);
});
