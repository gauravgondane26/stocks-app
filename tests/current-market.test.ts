import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ cookie: undefined as string | undefined, country: null as string | null }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (request.cookie ? { value: request.cookie } : undefined) }),
  headers: async () => new Headers(request.country ? { "x-vercel-ip-country": request.country } : {}),
}));

const { getCurrentMarket } = await import("@/lib/market/current");

beforeEach(() => {
  request.cookie = undefined;
  request.country = null;
});

describe("getCurrentMarket", () => {
  it("follows the visitor's location", async () => {
    request.country = "IN";
    expect(await getCurrentMarket()).toBe("IN");
    request.country = "GB";
    expect(await getCurrentMarket()).toBe("US");
  });

  it("starts on US without a location, as in local development", async () => {
    expect(await getCurrentMarket()).toBe("US");
  });

  it("lets the switcher's choice beat the location", async () => {
    request.country = "IN";
    request.cookie = "US";
    expect(await getCurrentMarket()).toBe("US");
  });

  it("ignores a cookie that isn't a market", async () => {
    request.country = "IN";
    request.cookie = "XX";
    expect(await getCurrentMarket()).toBe("IN");
  });
});
