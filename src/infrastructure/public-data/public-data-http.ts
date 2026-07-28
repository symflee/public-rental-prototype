export type PublicDataHttpResponse = Readonly<{
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
}>;

export type PublicDataFetch = (
  input: string | URL,
  request?: RequestInit,
) => Promise<PublicDataHttpResponse>;
