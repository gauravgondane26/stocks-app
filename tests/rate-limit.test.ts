import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { allowRequest, clientIp } from "@/lib/rate-limit";

describe("clientIp", () => {
  it("takes the first x-forwarded-for address", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to a shared bucket", () => {
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.8" }))).toBe("203.0.113.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("allowRequest", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-11T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to the limit in a window, then refuses", () => {
    const key = "test:limit";
    expect([1, 2, 3].map(() => allowRequest(key, 3, 60_000))).toEqual([true, true, true]);
    expect(allowRequest(key, 3, 60_000)).toBe(false);
  });

  it("starts a new window once the old one ends", () => {
    const key = "test:window";
    allowRequest(key, 1, 60_000);
    expect(allowRequest(key, 1, 60_000)).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(allowRequest(key, 1, 60_000)).toBe(true);
  });

  it("counts each key separately", () => {
    allowRequest("test:a", 1, 60_000);
    expect(allowRequest("test:a", 1, 60_000)).toBe(false);
    expect(allowRequest("test:b", 1, 60_000)).toBe(true);
  });
});
