import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { allowCaller, allowRequest, clientIp } from "@/lib/rate-limit";

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

describe("allowCaller", () => {
  const limits = { perCaller: 2, allGuests: 3, windowMs: 60_000 };

  it("limits a signed-in person by user id only", () => {
    const caller = { userId: "user-1" };
    expect([1, 2].map(() => allowCaller("test-user", caller, limits))).toEqual([true, true]);
    expect(allowCaller("test-user", caller, limits)).toBe(false);
    expect(allowCaller("test-user", { userId: "user-2" }, limits)).toBe(true);
  });

  it("limits each guest IP, and all guests together", () => {
    const scope = "test-guest";
    expect([1, 2].map(() => allowCaller(scope, { ip: "203.0.113.1" }, limits))).toEqual([true, true]);
    expect(allowCaller(scope, { ip: "203.0.113.1" }, limits)).toBe(false);
    expect(allowCaller(scope, { ip: "203.0.113.2" }, limits)).toBe(true);
    expect(allowCaller(scope, { ip: "203.0.113.3" }, limits)).toBe(false);
    // Guests don't use up a signed-in person's allowance.
    expect(allowCaller(scope, { userId: "user-1" }, limits)).toBe(true);
  });
});
