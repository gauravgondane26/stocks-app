import "server-only";

import type { MarketDataResult } from "@/lib/market/types";

const TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 500;
const USER_AGENT = "OpenWatch/0.1 (personal portfolio project)";

type FetchJsonOptions = {
  // Seconds to reuse a successful response.
  revalidate: number;
  // Names the source in logs. URLs are never logged because they can hold API keys.
  source: string;
  headers?: Record<string, string>;
};

const isRetryable = (status: number) => status === 429 || status >= 500;

const attempt = async <T>(
  url: string,
  { revalidate, source, headers }: FetchJsonOptions,
  read: (response: Response) => Promise<T>,
): Promise<MarketDataResult<T> & { retry?: boolean }> => {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, ...headers },
      next: { revalidate },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.ok) {
      return { ok: true, data: await read(response) };
    }
    if (response.status === 404) return { ok: false, reason: "not_found" };

    console.warn(`${source} request failed with status ${response.status}`);
    return {
      ok: false,
      reason: "unavailable",
      retry: isRetryable(response.status),
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "unknown error";
    console.warn(`${source} request failed: ${name}`);
    return { ok: false, reason: "unavailable", retry: true };
  }
};

// One retry for rate limits, server errors and network failures, then give up so
// that the caller can show "data unavailable".
const fetchWithRetry = async <T>(
  url: string,
  options: FetchJsonOptions,
  read: (response: Response) => Promise<T>,
): Promise<MarketDataResult<T>> => {
  const first = await attempt<T>(url, options, read);
  if (first.ok || !first.retry) return first;

  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  return attempt<T>(url, options, read);
};

export const fetchJson = <T>(url: string, options: FetchJsonOptions) =>
  fetchWithRetry<T>(url, options, (response) => response.json() as Promise<T>);

// For feeds such as RSS that aren't JSON.
export const fetchText = (url: string, options: FetchJsonOptions) =>
  fetchWithRetry<string>(url, options, (response) => response.text());
