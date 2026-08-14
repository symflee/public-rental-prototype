import { createHmac, randomUUID } from "node:crypto";

export const EXPERIMENT_VISITOR_COOKIE_NAME = "public_rental_experiment_visitor";

const VISITOR_COOKIE_MAXIMUM_AGE_SECONDS = 60 * 60 * 24 * 30;
const VISITOR_HASH_SECRET_MINIMUM_LENGTH = 32;
const VISITOR_IDENTIFIER_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export type ExperimentVisitorIdentity = Readonly<{
  setCookieHeader?: string;
  visitorHash: string;
}>;

type VisitorIdentityOptions = Readonly<{
  createIdentifier?: () => string;
  environment?: string;
  secret?: string;
}>;

export function resolveExperimentVisitorIdentity(
  request: Request,
  options: VisitorIdentityOptions = {},
): ExperimentVisitorIdentity | undefined {
  const secret = options.secret ?? readExperimentVisitorHashSecret();
  if (!hasSecureHashSecret(secret)) return undefined;
  const identifier = readVisitorIdentifier(request.headers.get("cookie"));
  if (identifier) return { visitorHash: createVisitorHash(identifier, secret) };
  return createNewVisitorIdentity(secret, options);
}

export function hasExperimentVisitorHashSecret() {
  return hasSecureHashSecret(readExperimentVisitorHashSecret());
}

export function readExperimentVisitorHashSecret() {
  return process.env.ANALYTICS_VISITOR_HASH_SECRET;
}

function createNewVisitorIdentity(secret: string, options: VisitorIdentityOptions) {
  const createIdentifier = options.createIdentifier ?? randomUUID;
  const identifier = createIdentifier();
  const environment = options.environment ?? process.env.NODE_ENV;
  return {
    setCookieHeader: createVisitorCookieHeader(identifier, environment),
    visitorHash: createVisitorHash(identifier, secret),
  };
}

function readVisitorIdentifier(cookieHeader: string | null) {
  if (!cookieHeader) return undefined;
  const cookiePrefix = `${EXPERIMENT_VISITOR_COOKIE_NAME}=`;
  const cookie = cookieHeader.split(";").map(trimText).find(startsWith(cookiePrefix));
  if (!cookie) return undefined;
  return readValidIdentifier(cookie.slice(cookiePrefix.length));
}

function createVisitorHash(identifier: string, secret: string) {
  return createHmac("sha256", secret).update(identifier).digest("hex");
}

function createVisitorCookieHeader(identifier: string, environment: string | undefined) {
  const attributes = createCookieAttributes(identifier);
  if (environment === "production") attributes.push("Secure");
  return attributes.join("; ");
}

function createCookieAttributes(identifier: string) {
  return [
    `${EXPERIMENT_VISITOR_COOKIE_NAME}=${identifier}`,
    `Max-Age=${VISITOR_COOKIE_MAXIMUM_AGE_SECONDS}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
}

function readValidIdentifier(value: string) {
  if (!VISITOR_IDENTIFIER_PATTERN.test(value)) return undefined;
  return value.toLowerCase();
}

function startsWith(prefix: string) {
  return (value: string) => value.startsWith(prefix);
}

function trimText(value: string) {
  return value.trim();
}

function hasSecureHashSecret(value: string | undefined): value is string {
  return Boolean(value && value.trim().length >= VISITOR_HASH_SECRET_MINIMUM_LENGTH);
}
