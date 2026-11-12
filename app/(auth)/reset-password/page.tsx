"use client";

import Link from "next/link";
import { use } from "react";

import ResetPasswordForm from "@/components/forms/ResetPasswordForm";

// Opened from the password reset email: /reset-password?token=...
const ResetPassword = ({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) => {
  const { token } = use(searchParams);

  return (
    <>
      <h1 className="form-title mb-3!">Choose a new password</h1>
      {typeof token === "string" && token ? (
        <>
          <p className="mb-10 text-gray-500">This link works once, for one hour.</p>
          <ResetPasswordForm token={token} />
        </>
      ) : (
        <p className="text-gray-500">
          This reset link isn&apos;t complete.{" "}
          <Link href="/forgot-password" className="footer-link">
            Ask for a new one
          </Link>
          .
        </p>
      )}
    </>
  );
};

export default ResetPassword;
