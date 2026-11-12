"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/lib/better-auth/auth";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { validateSignIn, validateSignUp } from "@/lib/validation/auth";
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

const getErrorCode = (error: unknown): string | undefined =>
  error instanceof APIError ? error.body?.code : undefined;

export const signUpWithEmail = async (
  input: SignUpFormData,
): Promise<AuthActionError | void> => {
  const result = validateSignUp(input);
  if (!result.valid) return { error: result.error };

  const { fullName, email, password, ...profile } = result.data;

  const requestHeaders = await headers();
  if (!allowRequest(`sign-up:ip:${clientIp(requestHeaders)}`, SIGN_UPS_PER_IP, SIGN_UP_WINDOW_MS)) {
    return { error: TOO_MANY_ERROR };
  }

  let userId: string;
  try {
    const auth = await getAuth();
    const { user } = await auth.api.signUpEmail({
      body: { name: fullName, email, password, ...profile },
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

  await queueWelcomeEmail(userId);

  // redirect() works by throwing, so it has to stay outside the try block.
  redirect("/");
};

export const signInWithEmail = async (
  input: SignInFormData,
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

  redirect("/");
};

export const signOut = async (): Promise<AuthActionError | void> => {
  try {
    const auth = await getAuth();
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    console.error("Sign out failed:", getErrorCode(error) ?? error);
    return { error: GENERIC_ERROR };
  }

  redirect("/sign-in");
};
