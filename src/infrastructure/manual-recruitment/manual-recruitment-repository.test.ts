import { expect, test } from "vitest";

import {
  createManualRecruitmentRepository,
  createManualRecruitmentRepositoryWithExecutor,
  ManualRecruitmentDatabaseConfigurationError,
  type ManualRecruitmentSqlExecutor,
} from "./manual-recruitment-repository";
import type { ManualRecruitmentNoticeInput } from "./manual-recruitment-types";
import { MANUAL_RECRUITMENT_SCHEMA_STATEMENTS } from "./manual-recruitment-schema";

test("수기 공고와 여러 단지 연결을 한 SQL로 추가한다", async () => {
  const calls: unknown[][] = [];
  const repository = createManualRecruitmentRepositoryWithExecutor(
    createExecutor(calls, [{ inserted: true }]),
  );

  await expect(repository.append(createNotice())).resolves.toBe(true);

  expect(calls).toHaveLength(1);
  expect(calls[0]?.[0]).toContain("INSERT INTO public_rental_manual_recruitment_notices");
  expect(calls[0]?.[0]).toContain("INSERT INTO public_rental_manual_recruitment_locations");
  expect(calls[0]?.[1]).toEqual(createParameters());
});

test("같은 공고 식별자는 덮어쓰지 않는다", async () => {
  const repository = createManualRecruitmentRepositoryWithExecutor(
    createExecutor([], [{ inserted: false }]),
  );

  await expect(repository.append(createNotice())).resolves.toBe(false);
});

test("활성 수기 공고와 연결된 단지 목록을 읽는다", async () => {
  const repository = createManualRecruitmentRepositoryWithExecutor(
    createExecutor([], [createDatabaseNotice()]),
  );

  await expect(repository.readActive()).resolves.toEqual([createNotice()]);
});

test("활성 공고만 철회하고 이력을 삭제하지 않는다", async () => {
  const calls: unknown[][] = [];
  const repository = createManualRecruitmentRepositoryWithExecutor(
    createExecutor(calls, [{ notice_id: "20853" }]),
  );

  await expect(repository.revoke("20853")).resolves.toBe(true);
  expect(calls[0]?.[0]).toContain("SET revoked_at = now()");
  expect(calls[0]?.[0]).not.toContain("DELETE");
});

test("과거 공고 재시드는 내용을 갱신하고 철회를 복구하며 단지 연결을 교체한다", async () => {
  const calls: unknown[][] = [];
  const repository = createManualRecruitmentRepositoryWithExecutor(createExecutor(calls, []));

  await repository.replaceHistorical(createNotice());

  expect(calls[0]?.[0]).toContain("ON CONFLICT (notice_id) DO UPDATE");
  expect(calls[0]?.[0]).toContain("revoked_at = NULL");
  expect(calls[0]?.[0]).toContain("location_id NOT IN");
  expect(calls[0]?.[1]).toEqual(createParameters());
});

test("DB 연결이 없으면 관리자 쓰기를 명확히 거절한다", async () => {
  const repository = createManualRecruitmentRepository("");

  await expect(repository.append(createNotice())).rejects.toBeInstanceOf(
    ManualRecruitmentDatabaseConfigurationError,
  );
  await expect(repository.readActive()).rejects.toBeInstanceOf(
    ManualRecruitmentDatabaseConfigurationError,
  );
  await expect(repository.replaceHistorical(createNotice())).rejects.toBeInstanceOf(
    ManualRecruitmentDatabaseConfigurationError,
  );
});

test("런타임에서도 수기 공고 스키마를 재실행 가능하게 초기화한다", async () => {
  const calls: unknown[][] = [];
  const repository = createManualRecruitmentRepositoryWithExecutor(createExecutor(calls, []));

  await repository.initialize();

  expect(calls).toHaveLength(MANUAL_RECRUITMENT_SCHEMA_STATEMENTS.length);
  expect(calls.every((call) => String(call[0]).includes("IF NOT EXISTS"))).toBe(true);
});

function createExecutor(
  calls: unknown[][],
  rows: readonly unknown[],
): ManualRecruitmentSqlExecutor {
  return {
    execute: async (statement, parameters) => {
      calls.push([statement, parameters]);
      return rows;
    },
  };
}

function createNotice(): ManualRecruitmentNoticeInput {
  return {
    announcedAt: "2026-07-20",
    applicationEndsAt: "2026-08-14T14:59:59.999Z",
    applicationStartsAt: "2026-07-26T15:00:00.000Z",
    evidenceUrl: "https://apply.lh.or.kr/evidence/20853",
    id: "20853",
    locationIds: ["30855346", "31297390"],
    sourceKind: "MANUAL_REVIEW",
    title: "하남감일8단지. 미사13단지 영구임대주택 예비입주자 모집공고",
    url: "https://apply.lh.or.kr/notices/20853",
  };
}

function createDatabaseNotice() {
  return {
    announced_at: new Date("2026-07-20T00:00:00.000Z"),
    application_ends_at: new Date("2026-08-14T14:59:59.999Z"),
    application_starts_at: new Date("2026-07-26T15:00:00.000Z"),
    evidence_url: "https://apply.lh.or.kr/evidence/20853",
    location_ids: ["30855346", "31297390"],
    notice_id: "20853",
    source_kind: "MANUAL_REVIEW",
    title: "하남감일8단지. 미사13단지 영구임대주택 예비입주자 모집공고",
    url: "https://apply.lh.or.kr/notices/20853",
  };
}

function createParameters() {
  const notice = createNotice();
  return [
    notice.id,
    notice.title,
    notice.url,
    notice.announcedAt,
    notice.applicationStartsAt,
    notice.applicationEndsAt,
    notice.sourceKind,
    notice.evidenceUrl,
    JSON.stringify(notice.locationIds),
  ];
}
