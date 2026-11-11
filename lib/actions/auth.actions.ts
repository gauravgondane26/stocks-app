"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/lib/better-auth/auth";
import { validateSignIn, validateSignUp } from "@/lib/validation/auth";
import { queueWelcomeEmail } from "@/lib/welcome";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const getErrorCode = (error: unknown): string | undefined =>
  error instanceof APIError ? error.body?.code : undefined;

export const signUpWithEmail = async (
  input: SignUpFormData,
): Promise<AuthActionError | void> => {
  const result = validateSignUp(input);
  if (!result.valid) return { error: result.error };

  const { fullName, email, password, ...profile } = result.data;

  let userId: string;
  try {
    const auth = await getAuth();
    const { user } = await auth.api.signUpEmail({
      body: { name: fullName, email, password, ...profile },
      headers: await headers(),
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

  try {
    const auth = await getAuth();
    await auth.api.signInEmail({
      body: result.data,
      headers: await headers(),
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
