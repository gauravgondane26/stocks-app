import { describe, expect, it } from "vitest";

import { validateSignIn, validateSignUp } from "@/lib/validation/auth";

describe("validateSignUp", () => {
  const base = { fullName: "Test User", email: "T@Example.com ", password: "password123", riskTolerance: "Medium" };

  it.each([
    ["India with an NSE sector and Active trading", { country: "IN", investmentGoals: "Active trading", preferredIndustry: "Banking & Financial Services" }, true],
    ["India with a US industry", { country: "IN", investmentGoals: "Growth", preferredIndustry: "Technology" }, false],
    ["US with an NSE sector", { country: "US", investmentGoals: "Growth", preferredIndustry: "FMCG" }, false],
    ["US with a US industry", { country: "US", investmentGoals: "Income", preferredIndustry: "Technology" }, true],
    ["GB, which uses the US market, with a US industry", { country: "GB", investmentGoals: "Growth", preferredIndustry: "Energy" }, true],
  ])("%s", (_, profile, valid) => {
    expect(validateSignUp({ ...base, ...profile }).valid).toBe(valid);
  });

  it("trims and lower-cases the email", () => {
    const result = validateSignUp({ ...base, country: "US", investmentGoals: "Growth", preferredIndustry: "Technology" });
    expect(result.valid && result.data.email).toBe("t@example.com");
  });

  it("refuses short passwords and unknown countries", () => {
    const profile = { country: "US", investmentGoals: "Growth", preferredIndustry: "Technology" };
    expect(validateSignUp({ ...base, ...profile, password: "short" }).valid).toBe(false);
    expect(validateSignUp({ ...base, ...profile, country: "XX" }).valid).toBe(false);
  });

  it("refuses input that isn't an object of strings", () => {
    expect(validateSignUp(null).valid).toBe(false);
    expect(validateSignUp({ ...base, email: { $ne: "" } }).valid).toBe(false);
  });
});

describe("validateSignIn", () => {
  it("needs an email and a password", () => {
    expect(validateSignIn({ email: "t@example.com", password: "x" }).valid).toBe(true);
    expect(validateSignIn({ email: "t@example.com", password: "" }).valid).toBe(false);
    expect(validateSignIn({ email: "nope", password: "x" }).valid).toBe(false);
  });

  it("gives the generic error for an over-long password", () => {
    expect(validateSignIn({ email: "t@example.com", password: "x".repeat(129) })).toEqual({
      valid: false,
      error: "Invalid email or password.",
    });
  });
});
