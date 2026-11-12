import { describe, expect, it } from "vitest";

import { authPath, safeNextPath } from "@/lib/auth-path";

describe("safeNextPath", () => {
  it.each([
    ["/watchlist"],
    ["/stocks/IN/RELIANCE"],
    ["/stocks/US/BRK.B?tab=plan"],
  ])("keeps the site path %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    ["another site", "https://evil.example"],
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash, which browsers read as a slash", "/\\evil.example"],
    ["a tab, which browsers drop", "/\t/evil.example"],
    ["a newline", "/\n/evil.example"],
    ["a relative path", "watchlist"],
    ["a script URL", "javascript:alert(1)"],
    ["a repeated query parameter", ["/a", "/b"]],
    ["nothing", undefined],
    ["a very long path", `/${"a".repeat(600)}`],
  ])("sends %s home", (_, value) => {
    expect(safeNextPath(value)).toBe("/");
  });
});

describe("authPath", () => {
  it("adds the page to come back to", () => {
    expect(authPath("/sign-in", "/stocks/US/BRK.B?tab=plan")).toBe(
      "/sign-in?next=%2Fstocks%2FUS%2FBRK.B%3Ftab%3Dplan",
    );
    expect(authPath("/sign-up", "/watchlist")).toBe("/sign-up?next=%2Fwatchlist");
  });

  it("leaves it off for home or an unsafe path", () => {
    expect(authPath("/sign-in", "/")).toBe("/sign-in");
    expect(authPath("/sign-in", "//evil.example")).toBe("/sign-in");
    expect(authPath("/sign-in")).toBe("/sign-in");
  });
});
