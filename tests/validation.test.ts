import { describe, expect, it } from "vitest";

import { validateSignIn, validateSignUp } from "@/lib/validation/auth";

describe("validateSignUp", () => {
  const base = { fullName: "Test User", email: "T@Example.com ", password: "password123" };

  it("needs only a name, email and password, and keeps only those", () => {
    const result = validateSignUp({ ...base, country: "IN", riskTolerance: "High" });
    expect(result).toEqual({
      valid: true,
      data: { fullName: "Test User", email: "t@example.com", password: "password123" },
    });
  });

  it("refuses a missing name and a short password", () => {
    expect(validateSignUp({ ...base, fullName: " " }).valid).toBe(false);
    expect(validateSignUp({ ...base, password: "short" }).valid).toBe(false);
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
