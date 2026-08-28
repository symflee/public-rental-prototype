import { expect, test, vi } from "vitest";

import {
  appendManualRecruitmentNotice,
  ManualRecruitmentConflictError,
  ManualRecruitmentNotFoundError,
  ManualRecruitmentValidationError,
  readActiveManualRecruitmentNotices,
  replaceHistoricalManualRecruitmentNotice,
  revokeManualRecruitmentNotice,
} from "./manual-recruitment-service";
import type { ManualRecruitmentNoticeInput } from "./manual-recruitment-types";

test("공식 LH 공고를 정규화하고 현재 스냅샷의 단지에 추가한다", async () => {
  const dependencies = createDependencies();

  const notice = await appendManualRecruitmentNotice(createBody(), dependencies);

  expect(notice.applicationStartsAt).toBe("2026-07-26T15:00:00.000Z");
  expect(notice.applicationEndsAt).toBe("2026-08-14T14:59:59.999Z");
  expect(dependencies.repository.append).toHaveBeenCalledWith(notice);
});

test("없는 단지, 비공식 URL, 잘못된 기간을 거절한다", async () => {
  const dependencies = createDependencies();
  const unknown = createBody({ locationIds: ["unknown"] });
  const unofficial = createBody({ url: "https://example.com/notices/20853" });
  const reversed = createBody({ applicationEndsAt: "2026-07-01" });

  await expect(appendManualRecruitmentNotice(unknown, dependencies)).rejects.toBeInstanceOf(
    ManualRecruitmentValidationError,
  );
  await expect(appendManualRecruitmentNotice(unofficial, dependencies)).rejects.toBeInstanceOf(
    ManualRecruitmentValidationError,
  );
  await expect(appendManualRecruitmentNotice(reversed, dependencies)).rejects.toBeInstanceOf(
    ManualRecruitmentValidationError,
  );
});

test("관리자 입력은 수기 검토 출처만 허용한다", async () => {
  const dependencies = createDependencies();
  const input = createBody({ sourceKind: "AUTOMATED_IMPORT" });

  await expect(appendManualRecruitmentNotice(input, dependencies)).rejects.toBeInstanceOf(
    ManualRecruitmentValidationError,
  );
});

test("기존 식별자와 이미 철회된 공고를 구분한다", async () => {
  const dependencies = createDependencies();
  dependencies.repository.append.mockResolvedValue(false);
  dependencies.repository.revoke.mockResolvedValue(false);

  await expect(appendManualRecruitmentNotice(createBody(), dependencies)).rejects.toBeInstanceOf(
    ManualRecruitmentConflictError,
  );
  await expect(revokeManualRecruitmentNotice("20853", dependencies)).rejects.toBeInstanceOf(
    ManualRecruitmentNotFoundError,
  );
});

test("활성 공고 조회와 철회를 저장소에 위임한다", async () => {
  const dependencies = createDependencies();
  const notice = createNormalizedNotice();
  dependencies.repository.readActive.mockResolvedValue([notice]);

  await expect(readActiveManualRecruitmentNotices(dependencies)).resolves.toEqual([notice]);
  await expect(revokeManualRecruitmentNotice("20853", dependencies)).resolves.toBeUndefined();
  expect(dependencies.repository.revoke).toHaveBeenCalledWith("20853");
});

test("과거 공고 재시드도 검증과 기간 정규화를 거쳐 교체한다", async () => {
  const dependencies = createDependencies();

  await replaceHistoricalManualRecruitmentNotice(createBody(), dependencies);

  expect(dependencies.repository.replaceHistorical).toHaveBeenCalledWith(createNormalizedNotice());
});

function createDependencies() {
  return {
    locationIds: new Set(["30855346", "31297390"]),
    repository: {
      append: vi.fn(async () => true),
      initialize: vi.fn(async () => undefined),
      isEnabled: () => true,
      readActive: vi.fn(async () => [] as readonly ManualRecruitmentNoticeInput[]),
      replaceHistorical: vi.fn(async () => undefined),
      revoke: vi.fn(async () => true),
    },
  };
}

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    announcedAt: "2026-07-20",
    applicationEndsAt: "2026-08-14",
    applicationStartsAt: "2026-07-27",
    evidenceUrl: "https://apply.lh.or.kr/evidence/20853",
    id: "20853",
    locationIds: ["30855346", "31297390"],
    sourceKind: "MANUAL_REVIEW",
    title: "하남감일8단지. 미사13단지 영구임대주택 예비입주자 모집공고",
    url: "https://apply.lh.or.kr/notices/20853",
    ...overrides,
  };
}

function createNormalizedNotice(): ManualRecruitmentNoticeInput {
  return {
    ...(createBody() as ManualRecruitmentNoticeInput),
    applicationEndsAt: "2026-08-14T14:59:59.999Z",
    applicationStartsAt: "2026-07-26T15:00:00.000Z",
  };
}
