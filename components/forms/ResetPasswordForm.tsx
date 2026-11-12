"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { toast } from "sonner";

import InputField from "@/components/forms/InputField";
import { Button } from "@/components/ui/button";
import { resetPassword } from "@/lib/actions/auth.actions";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/validation/auth";

type ResetFormData = { password: string; confirmPassword: string };

// Sets a new password from the token in the emailed link.
const ResetPasswordForm = ({ token }: { token: string }) => {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormData>({
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onSubmit",
  });

  const onSubmit: SubmitHandler<ResetFormData> = async ({ password }) => {
    try {
      const result = await resetPassword({ token, password });
      if (result.ok) setDone(true);
      else toast.error(result.error);
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  if (done) {
    return (
      <div className="space-y-5">
        <p className="text-gray-400">
          Your password has been changed, and any other devices signed in to your
          account have been signed out.
        </p>
        <Link href="/sign-in" className="yellow-btn flex w-full items-center justify-center">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <InputField
        name="password"
        label="New password"
        type="password"
        placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
        autoComplete="new-password"
        register={register}
        error={errors.password}
        validation={{
          required: "Enter a new password",
          minLength: {
            value: PASSWORD_MIN_LENGTH,
            message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
          },
          maxLength: {
            value: PASSWORD_MAX_LENGTH,
            message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
          },
        }}
      />
      <InputField
        name="confirmPassword"
        label="Confirm new password"
        type="password"
        placeholder="Type it again"
        autoComplete="new-password"
        register={register}
        error={errors.confirmPassword}
        validation={{
          required: "Type the password again",
          validate: (value) => value === getValues("password") || "Passwords don't match",
        }}
      />
      <Button type="submit" disabled={isSubmitting} className="yellow-btn mt-5 w-full">
        {isSubmitting ? "Saving..." : "Set new password"}
      </Button>
    </form>
  );
};

export default ResetPasswordForm;
