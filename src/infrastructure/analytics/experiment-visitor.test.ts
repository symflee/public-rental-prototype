import { createHmac } from "node:crypto";

import { expect, test } from "vitest";

import {
  EXPERIMENT_VISITOR_COOKIE_NAME,
  resolveExperimentVisitorIdentity,
} from "./experiment-visitor";

const SECRET = "a-long-experiment-visitor-secret-for-tests";
const VISITOR_IDENTIFIER = "36b8f84d-df4e-4d49-b662-bcde71a8764f";

test("새 방문자는 30일 HttpOnly 쿠키와 HMAC 해시를 받는다", () => {
  const identity = resolveExperimentVisitorIdentity(createRequest(), {
    createIdentifier: () => VISITOR_IDENTIFIER,
    environment: "production",
    secret: SECRET,
  });

  expect(identity?.visitorHash).toBe(createExpectedHash());
  expect(identity?.visitorHash).not.toContain(VISITOR_IDENTIFIER);
  expect(identity?.setCookieHeader).toContain(`${EXPERIMENT_VISITOR_COOKIE_NAME}=`);
  expect(identity?.setCookieHeader).toContain("Max-Age=2592000");
  expect(identity?.setCookieHeader).toContain("HttpOnly");
  expect(identity?.setCookieHeader).toContain("SameSite=Lax");
  expect(identity?.setCookieHeader).toContain("Secure");
});

test("기존 방문자 쿠키는 재사용하고 다시 발급하지 않는다", () => {
  const request = createRequest(`${EXPERIMENT_VISITOR_COOKIE_NAME}=${VISITOR_IDENTIFIER}`);
  const identity = resolveExperimentVisitorIdentity(request, { secret: SECRET });

  expect(identity).toEqual({ visitorHash: createExpectedHash() });
});

test("해시 비밀값이 없거나 쿠키가 변조되면 원문을 분석에 사용하지 않는다", () => {
  expect(resolveExperimentVisitorIdentity(createRequest(), { secret: "" })).toBeUndefined();
  expect(
    resolveExperimentVisitorIdentity(createRequest(), { secret: "too-short" }),
  ).toBeUndefined();
  const request = createRequest(`${EXPERIMENT_VISITOR_COOKIE_NAME}=not-a-uuid`);
  const identity = resolveExperimentVisitorIdentity(request, {
    createIdentifier: () => VISITOR_IDENTIFIER,
    secret: SECRET,
  });

  expect(identity?.visitorHash).toBe(createExpectedHash());
  expect(identity?.setCookieHeader).toBeDefined();
});

function createRequest(cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return new Request("https://example.com", { headers });
}

function createExpectedHash() {
  return createHmac("sha256", SECRET).update(VISITOR_IDENTIFIER).digest("hex");
}
