import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ip: "203.0.113.1",
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
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
  getAuth: async () => ({
    api: {
      signInEmail: mocks.signInEmail,
      signUpEmail: mocks.signUpEmail,
      requestPasswordReset: mocks.requestPasswordReset,
      resetPassword: mocks.resetPassword,
    },
  }),
}));
vi.mock("@/lib/welcome", () => ({ queueWelcomeEmail: mocks.queueWelcomeEmail }));
vi.mock("@/lib/market/current", () => ({ getCurrentMarket: async () => "IN" }));

const { requestPasswordReset, resetPassword, signInWithEmail, signUpWithEmail } = await import(
  "@/lib/actions/auth.actions"
);

const TOO_MANY = { error: "Too many attempts. Wait a few minutes and try again." };
const wrongPassword = () => new APIError("UNAUTHORIZED", { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid" });

beforeEach(() => {
  mocks.signInEmail.mockReset().mockRejectedValue(wrongPassword());
  mocks.signUpEmail.mockReset().mockResolvedValue({ user: { id: "new-user" } });
  mocks.queueWelcomeEmail.mockReset();
  mocks.requestPasswordReset.mockReset().mockResolvedValue({ status: true });
  mocks.resetPassword.mockReset().mockResolvedValue({ status: true });
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
    await expect(signInWithEmail({ email: "ok@example.com", password: "password" })).rejects.toThrow(/^redirect:\/$/);
  });

  it("goes back to the page the guest came from, but only on this site", async () => {
    mocks.ip = "192.0.2.61";
    const ok = { email: "ok@example.com", password: "password" };
    mocks.signInEmail.mockResolvedValue({});
    await expect(signInWithEmail(ok, "/stocks/IN/RELIANCE")).rejects.toThrow(/^redirect:\/stocks\/IN\/RELIANCE$/);
    await expect(signInWithEmail(ok, "//evil.example")).rejects.toThrow(/^redirect:\/$/);
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

  it("sends Better Auth only the name, email and password, and welcomes them to their market", async () => {
    mocks.ip = "192.0.2.85";
    await expect(signUpWithEmail({ ...input, email: "only@example.com" })).rejects.toThrow(/^redirect:\/$/);
    expect(mocks.signUpEmail.mock.calls[0][0].body).toEqual({
      name: "New User",
      email: "only@example.com",
      password: "password123",
    });
    expect(mocks.queueWelcomeEmail).toHaveBeenCalledWith("new-user", "IN");
  });

  it("goes back to the page the guest came from", async () => {
    mocks.ip = "192.0.2.90";
    await expect(signUpWithEmail(input, "/watchlist")).rejects.toThrow(/^redirect:\/watchlist$/);
  });
});

describe("requestPasswordReset", () => {
  it("asks Better Auth with the cleaned email and answers ok", async () => {
    mocks.ip = "192.0.2.100";
    expect(await requestPasswordReset({ email: " Someone@Example.com " })).toEqual({ ok: true });
    expect(mocks.requestPasswordReset.mock.calls[0][0].body).toEqual({ email: "someone@example.com" });
  });

  it("allows 3 requests per email an hour, from any IP", async () => {
    for (let i = 0; i < 3; i++) {
      mocks.ip = `198.51.100.${50 + i}`;
      expect(await requestPasswordReset({ email: "limited@example.com" })).toEqual({ ok: true });
    }
    mocks.ip = "198.51.100.99";
    expect(await requestPasswordReset({ email: "limited@example.com" })).toEqual({ ok: false, ...TOO_MANY });
    expect(mocks.requestPasswordReset).toHaveBeenCalledTimes(3);
  });

  it("refuses an invalid email without asking Better Auth", async () => {
    mocks.ip = "192.0.2.101";
    expect(await requestPasswordReset({ email: "nope" })).toEqual({ ok: false, error: "Enter a valid email address." });
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
  });
});

describe("resetPassword", () => {
  it("sets the new password from the token", async () => {
    mocks.ip = "192.0.2.110";
    expect(await resetPassword({ token: "abc123", password: "new-password" })).toEqual({ ok: true });
    expect(mocks.resetPassword.mock.calls[0][0].body).toEqual({ token: "abc123", newPassword: "new-password" });
  });

  it("explains an expired or used link", async () => {
    mocks.ip = "192.0.2.111";
    mocks.resetPassword.mockRejectedValueOnce(new APIError("BAD_REQUEST", { code: "INVALID_TOKEN", message: "Invalid token" }));
    expect(await resetPassword({ token: "old", password: "new-password" })).toEqual({
      ok: false,
      error: "This reset link has expired or was already used. Ask for a new one.",
    });
  });

  it("refuses a short password or missing token without asking Better Auth", async () => {
    mocks.ip = "192.0.2.112";
    expect((await resetPassword({ token: "abc", password: "short" })).ok).toBe(false);
    expect((await resetPassword({ token: "", password: "new-password" })).ok).toBe(false);
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });
});
