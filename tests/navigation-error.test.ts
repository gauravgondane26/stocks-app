import { redirect } from "next/navigation";
import { describe, expect, it } from "vitest";

import { isNextNavigation } from "@/lib/navigation-error";

const thrownBy = (fn: () => void): unknown => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected a throw");
};

describe("isNextNavigation", () => {
  it("spots Next's redirect error", () => {
    expect(isNextNavigation(thrownBy(() => redirect("/watchlist")))).toBe(true);
  });

  it("leaves real failures alone", () => {
    expect(isNextNavigation(new Error("network down"))).toBe(false);
    expect(isNextNavigation(undefined)).toBe(false);
  });
});
