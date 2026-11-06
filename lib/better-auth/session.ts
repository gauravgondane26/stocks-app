import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getAuth } from "@/lib/better-auth/auth";

// `cache` means a layout and page in the same request share one session lookup.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
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
