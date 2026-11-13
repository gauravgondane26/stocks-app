"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth-path";
import { getAuth } from "@/lib/better-auth/auth";
import { getCurrentMarket } from "@/lib/market/current";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import {
  validatePasswordReset,
  validatePasswordResetRequest,
  validateSignIn,
  validateSignUp,
} from "@/lib/validation/auth";
import { queueWelcomeEmail } from "@/lib/welcome";

const GENERIC_ERROR = "Something went wrong. Please try again.";
const TOO_MANY_ERROR = "Too many attempts. Wait a few minutes and try again.";

// Better Auth's own limiter only covers requests to its HTTP handler, and these
// actions call auth.api directly, so they limit themselves. Every attempt counts,
// not just failures. The email limit protects an account from password guessing
// spread over many IPs; the IP limit stops one client trying many emails.
const SIGN_IN_WINDOW_MS = 15 * 60_000;
const SIGN_INS_PER_EMAIL = 10;
const SIGN_INS_PER_IP = 30;
// Each sign-up sends a welcome email, so new accounts are limited per IP.
const SIGN_UP_WINDOW_MS = 60 * 60_000;
const SIGN_UPS_PER_IP = 5;
// Each request can send an email, so they're limited per IP and per address.
const RESET_REQUEST_WINDOW_MS = 60 * 60_000;
const RESET_REQUESTS_PER_IP = 10;
const RESET_REQUESTS_PER_EMAIL = 3;
const RESET_WINDOW_MS = 15 * 60_000;
const RESETS_PER_IP = 10;
const INVALID_RESET_LINK = "This reset link has expired or was already used. Ask for a new one.";

const getErrorCode = (error: unknown): string | undefined =>
  error instanceof APIError ? error.body?.code : undefined;

// `next` is where the person was going when they were asked to sign in.
export const signUpWithEmail = async (
  input: SignUpFormData,
  next?: unknown,
): Promise<AuthActionError | void> => {
  const result = validateSignUp(input);
  if (!result.valid) return { error: result.error };

  const { fullName, email, password } = result.data;

  const requestHeaders = await headers();
  if (!allowRequest(`sign-up:ip:${clientIp(requestHeaders)}`, SIGN_UPS_PER_IP, SIGN_UP_WINDOW_MS)) {
    return { error: TOO_MANY_ERROR };
  }

  let userId: string;
  try {
    const auth = await getAuth();
    const { user } = await auth.api.signUpEmail({
      body: { name: fullName, email, password },
      headers: requestHeaders,
    });
    userId = user.id;
  } catch (error) {
    const code = getErrorCode(error);
    if (code?.startsWith("USER_ALREADY_EXISTS")) {
      return { error: "An account with this email already exists." };
    }
    console.error("Sign up failed:", code ?? error);
    return { error: GENERIC_ERROR };
  }

  await queueWelcomeEmail(userId, await getCurrentMarket());

  // redirect() works by throwing, so it has to stay outside the try block.
  redirect(safeNextPath(next));
};

export const signInWithEmail = async (
  input: SignInFormData,
  next?: unknown,
): Promise<AuthActionError | void> => {
  const result = validateSignIn(input);
  if (!result.valid) return { error: result.error };

  const requestHeaders = await headers();
  if (
    !allowRequest(`sign-in:ip:${clientIp(requestHeaders)}`, SIGN_INS_PER_IP, SIGN_IN_WINDOW_MS) ||
    !allowRequest(`sign-in:email:${result.data.email}`, SIGN_INS_PER_EMAIL, SIGN_IN_WINDOW_MS)
  ) {
    return { error: TOO_MANY_ERROR };
  }

  try {
    const auth = await getAuth();
    await auth.api.signInEmail({
      body: result.data,
      headers: requestHeaders,
    });
  } catch (error) {
    const code = getErrorCode(error);
    if (code === "INVALID_EMAIL_OR_PASSWORD") {
      return { error: "Invalid email or password." };
    }
    console.error("Sign in failed:", code ?? error);
    return { error: GENERIC_ERROR };
  }

  redirect(safeNextPath(next));
};

export const signOut = async (): Promise<AuthActionError | void> => {
  try {
    const auth = await getAuth();
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    console.error("Sign out failed:", getErrorCode(error) ?? error);
    return { error: GENERIC_ERROR };
  }

  // Guests can browse, so signing out stays in the app.
  redirect("/");
};

// Answers the same way whether or not the email has an account, so it can't be used
// to find out who has signed up. Better Auth does the same, and the email sender in
// lib/better-auth/auth.ts swallows its own failures for the same reason.
export const requestPasswordReset = async (
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> => {
  const result = validatePasswordResetRequest(input);
  if (!result.valid) return { ok: false, error: result.error };
  const { email } = result.data;

  const requestHeaders = await headers();
  if (
    !allowRequest(`reset-request:ip:${clientIp(requestHeaders)}`, RESET_REQUESTS_PER_IP, RESET_REQUEST_WINDOW_MS) ||
    !allowRequest(`reset-request:email:${email}`, RESET_REQUESTS_PER_EMAIL, RESET_REQUEST_WINDOW_MS)
  ) {
    return { ok: false, error: TOO_MANY_ERROR };
  }

  try {
    const auth = await getAuth();
    await auth.api.requestPasswordReset({ body: { email }, headers: requestHeaders });
  } catch (error) {
    console.error("Password reset request failed:", getErrorCode(error) ?? error);
    return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: true };
};

// Sets the new password from the emailed token. The caller then signs in with it.
export const resetPassword = async (
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> => {
  const result = validatePasswordReset(input);
  if (!result.valid) return { ok: false, error: result.error };

  const requestHeaders = await headers();
  if (!allowRequest(`reset:ip:${clientIp(requestHeaders)}`, RESETS_PER_IP, RESET_WINDOW_MS)) {
    return { ok: false, error: TOO_MANY_ERROR };
  }

  try {
    const auth = await getAuth();
    await auth.api.resetPassword({
      body: { token: result.data.token, newPassword: result.data.password },
      headers: requestHeaders,
    });
  } catch (error) {
    const code = getErrorCode(error);
    if (code === "INVALID_TOKEN" || code === "USER_NOT_FOUND") return { ok: false, error: INVALID_RESET_LINK };
    console.error("Password reset failed:", code ?? error);
    return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: true };
};
