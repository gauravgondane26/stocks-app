"use client";

import { use } from "react";

import SignInForm from "@/components/forms/SignInForm";
import { safeNextPath } from "@/lib/auth-path";

// The full page, for direct visits and pages that need an account. In the app,
// guests get the same form in a dialog (components/AuthDialog.tsx).
// `next` is the page to go to after signing in.
const SignIn = ({ searchParams }: { searchParams: Promise<AuthSearchParams> }) => {
  const next = safeNextPath(use(searchParams).next);

  return (
    <>
      <h1 className="form-title mb-3!">Welcome Back</h1>
      <p className="mb-10 text-gray-500">
        Sign in to keep a watchlist, set alerts and save your trade settings.
      </p>
      <SignInForm next={next} />
    </>
  );
};

export default SignIn;
