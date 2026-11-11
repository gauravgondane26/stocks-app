import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { allowRequest } from "@/lib/rate-limit";

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
