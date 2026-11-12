import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

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

// Layouts don't re-render on client-side navigation, so every protected page
// must call this itself as well as relying on the (root) layout.
export const requireUser = async (): Promise<User> => {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
};
