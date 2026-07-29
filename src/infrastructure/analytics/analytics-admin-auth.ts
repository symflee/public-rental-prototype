export type AnalyticsAdministratorCredentials = Readonly<{
  password: string;
  username: string;
}>;

export function isAnalyticsAdministrator(
  authorization: string | null,
  credentials = readAnalyticsAdministratorCredentials(),
) {
  if (!credentials) return false;
  const provided = readBasicCredentials(authorization);
  if (!provided) return false;
  return provided.username === credentials.username && provided.password === credentials.password;
}

export function readAnalyticsAdministratorCredentials():
  AnalyticsAdministratorCredentials | undefined {
  const username = process.env.ANALYTICS_ADMIN_USERNAME;
  const password = process.env.ANALYTICS_ADMIN_PASSWORD;
  if (!hasText(username) || !hasText(password)) return undefined;
  return { password, username };
}

function readBasicCredentials(authorization: string | null) {
  if (!authorization?.startsWith("Basic ")) return undefined;
  return readDecodedCredentials(authorization.slice("Basic ".length));
}

function readDecodedCredentials(encoded: string) {
  try {
    return splitCredentials(atob(encoded));
  } catch {
    return undefined;
  }
}

function splitCredentials(value: string): AnalyticsAdministratorCredentials | undefined {
  const separator = value.indexOf(":");
  if (separator < 1) return undefined;
  return { password: value.slice(separator + 1), username: value.slice(0, separator) };
}

function hasText(value: string | undefined): value is string {
  return Boolean(value?.trim());
}
