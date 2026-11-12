"use client";

import { usePathname } from "next/navigation";

import { authPath } from "@/lib/auth-path";

// The sign-in or sign-up page, set to come back to the page the guest is on.
const useAuthHref = (page: "/sign-in" | "/sign-up" = "/sign-in"): string =>
  authPath(page, usePathname());

export default useAuthHref;
