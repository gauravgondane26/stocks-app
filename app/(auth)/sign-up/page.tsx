"use client";

import { use } from "react";

import SignUpForm from "@/components/forms/SignUpForm";
import { safeNextPath } from "@/lib/auth-path";

// The full page, for direct visits. In the app, guests get the same form in a
// dialog (components/AuthDialog.tsx). `next` is the page to go to afterwards.
const SignUp = ({ searchParams }: { searchParams: Promise<AuthSearchParams> }) => {
  const next = safeNextPath(use(searchParams).next);

  return (
    <>
      <h1 className="form-title">Sign Up and Personalize</h1>
      <SignUpForm next={next} />
    </>
  );
};

export default SignUp;
