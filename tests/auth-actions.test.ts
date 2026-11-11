import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ip: "203.0.113.1",
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  queueWelcomeEmail: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": `${mocks.ip}, 10.0.0.1` }),
}));
// The real redirect() throws, so the actions end the same way here.
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("@/lib/better-auth/auth", () => ({
  getAuth: async () => ({ api: { signInEmail: mocks.signInEmail, signUpEmail: mocks.signUpEmail } }),
}));
vi.mock("@/lib/welcome", () => ({ queueWelcomeEmail: mocks.queueWelcomeEmail }));

const { signInWithEmail, signUpWithEmail } = await import("@/lib/actions/auth.actions");

const TOO_MANY = { error: "Too many attempts. Wait a few minutes and try again." };
const wrongPassword = () => new APIError("UNAUTHORIZED", { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid" });

beforeEach(() => {
  mocks.signInEmail.mockReset().mockRejectedValue(wrongPassword());
  mocks.signUpEmail.mockReset().mockResolvedValue({ user: { id: "new-user" } });
  mocks.queueWelcomeEmail.mockReset();
});

describe("signInWithEmail", () => {
  it("allows 10 attempts per email, from any IP, then refuses without asking Better Auth", async () => {
    for (let i = 0; i < 10; i++) {
      mocks.ip = `198.51.100.${i}`;
      expect(await signInWithEmail({ email: "Victim@Example.com", password: `guess-${i}` })).toEqual({
        error: "Invalid email or password.",
      });
    }
    mocks.ip = "198.51.100.200";
    expect(await signInWithEmail({ email: "victim@example.com", password: "guess-10" })).toEqual(TOO_MANY);
    expect(mocks.signInEmail).toHaveBeenCalledTimes(10);
  });

  it("allows 30 attempts per IP across emails", async () => {
    mocks.ip = "192.0.2.50";
    for (let i = 0; i < 30; i++) {
      await signInWithEmail({ email: `user${i}@example.com`, password: "password" });
    }
    expect(await signInWithEmail({ email: "user30@example.com", password: "password" })).toEqual(TOO_MANY);
    expect(mocks.signInEmail).toHaveBeenCalledTimes(30);
  });

  it("redirects home on success", async () => {
    mocks.ip = "192.0.2.60";
    mocks.signInEmail.mockResolvedValueOnce({});
    await expect(signInWithEmail({ email: "ok@example.com", password: "password" })).rejects.toThrow("redirect:/");
  });

  it("doesn't count invalid input", async () => {
    mocks.ip = "192.0.2.70";
    expect(await signInWithEmail({ email: "not-an-email", password: "x" })).toEqual({ error: "Enter your email and password." });
    expect(mocks.signInEmail).not.toHaveBeenCalled();
  });
});

describe("signUpWithEmail", () => {
  const input = {
    fullName: "New User",
    email: "new@example.com",
    password: "password123",
    country: "US",
    investmentGoals: "Growth",
    riskTolerance: "Medium",
    preferredIndustry: "Technology",
  };

  it("allows 5 sign-ups per IP an hour, each queueing a welcome email", async () => {
    mocks.ip = "192.0.2.80";
    for (let i = 0; i < 5; i++) {
      await expect(signUpWithEmail({ ...input, email: `new${i}@example.com` })).rejects.toThrow("redirect:/");
    }
    expect(await signUpWithEmail({ ...input, email: "new5@example.com" })).toEqual(TOO_MANY);
    expect(mocks.signUpEmail).toHaveBeenCalledTimes(5);
    expect(mocks.queueWelcomeEmail).toHaveBeenCalledTimes(5);
  });
});
