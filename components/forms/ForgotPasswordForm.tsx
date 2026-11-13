"use client";

import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { toast } from "sonner";

import FooterLink from "@/components/forms/FooterLink";
import InputField from "@/components/forms/InputField";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/lib/actions/auth.actions";
import { authPath } from "@/lib/auth-path";
import { EMAIL_FIELD_RULES } from "@/lib/validation/auth";

// Used by the /forgot-password page and the sign-in dialog. The answer is the same
// whether or not the email has an account.
const ForgotPasswordForm = ({ next, onSwitch }: AuthFormProps) => {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({ defaultValues: { email: "" }, mode: "onSubmit" });

  const onSubmit: SubmitHandler<{ email: string }> = async ({ email }) => {
    try {
      const result = await requestPasswordReset({ email });
      if (result.ok) setSentTo(email.trim());
      else toast.error(result.error);
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  const backToSignIn = (
    <FooterLink
      text="Remembered it?"
      linkText="Back to sign in"
      href={authPath("/sign-in", next)}
      onClick={onSwitch}
    />
  );

  if (sentTo) {
    return (
      <div className="space-y-5">
        <p className="text-gray-400">
          If <span className="text-gray-100">{sentTo}</span> has an OpenWatch
          account, we&apos;ve emailed it a link to choose a new password. The
          link works for one hour. Check your spam folder if it doesn&apos;t
          arrive in a few minutes.
        </p>
        {backToSignIn}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <InputField
        name="email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        register={register}
        error={errors.email}
        validation={EMAIL_FIELD_RULES}
      />
      <Button type="submit" disabled={isSubmitting} className="yellow-btn mt-5 w-full">
        {isSubmitting ? "Sending..." : "Send reset link"}
      </Button>
      {backToSignIn}
    </form>
  );
};

export default ForgotPasswordForm;
