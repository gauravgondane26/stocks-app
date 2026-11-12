import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { authPath } from "@/lib/auth-path";
import { getAuth } from "@/lib/better-auth/auth";

// `cache` means a layout and page in the same request share one session lookup.
// headers() comes first: it marks the page as dynamic, so `next build` stops trying
// to prerender it before anything connects to the database.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const requestHeaders = await headers();
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;

  const { id, name, email, country } = session.user;
  return { id, name, email, country };
});

// Pages that need an account call this with their own path, so signing in comes
// back to them. Guests can browse everything else.
export const requireUser = async (returnTo = "/"): Promise<User> => {
  const user = await getCurrentUser();
  if (!user) redirect(authPath("/sign-in", returnTo));
  return user;
};
