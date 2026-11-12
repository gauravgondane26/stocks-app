"use client";

import { use } from "react";

import ForgotPasswordForm from "@/components/forms/ForgotPasswordForm";
import { safeNextPath } from "@/lib/auth-path";

// The full page, linked from /sign-in. In the app, guests get the same form in
// the sign-in dialog.
const ForgotPassword = ({ searchParams }: { searchParams: Promise<AuthSearchParams> }) => {
  const next = safeNextPath(use(searchParams).next);

  return (
    <>
      <h1 className="form-title mb-3!">Reset your password</h1>
      <p className="mb-10 text-gray-500">
        Enter your account&apos;s email and we&apos;ll send you a link to choose a new password.
      </p>
      <ForgotPasswordForm next={next} />
    </>
  );
};

export default ForgotPassword;
