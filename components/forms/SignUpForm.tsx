"use client";

import { useForm, type SubmitHandler } from "react-hook-form";
import { toast } from "sonner";

import FooterLink from "@/components/forms/FooterLink";
import InputField from "@/components/forms/InputField";
import { Button } from "@/components/ui/button";
import { signUpWithEmail } from "@/lib/actions/auth.actions";
import { authPath } from "@/lib/auth-path";
import { isNextNavigation } from "@/lib/navigation-error";
import {
  confirmPasswordRules,
  EMAIL_FIELD_RULES,
  NAME_MAX_LENGTH,
  newPasswordRules,
  PASSWORD_MIN_LENGTH,
} from "@/lib/validation/auth";

// The confirmation is only checked here and never sent to the server.
type SignUpFormValues = SignUpFormData & { confirmPassword: string };

// Used by the /sign-up page and the sign-in dialog.
const SignUpForm = ({ next, onSwitch }: AuthFormProps) => {
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>({
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    // Not on blur: an error appearing as focus leaves a field shifts the footer
    // link mid-click, so "Create one" or "Sign in" would miss.
    mode: "onSubmit",
  });

  const onSubmit: SubmitHandler<SignUpFormValues> = async ({ fullName, email, password }) => {
    try {
      // On success the action redirects, so a returned value is always an error.
      const result = await signUpWithEmail({ fullName, email, password }, next);
      if (result) toast.error(result.error);
    } catch (error) {
      if (isNextNavigation(error)) return;
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <InputField
        name="fullName"
        label="Full Name"
        placeholder="Your name"
        autoComplete="name"
        register={register}
        error={errors.fullName}
        validation={{
          required: "Enter your full name",
          maxLength: { value: NAME_MAX_LENGTH, message: "Name is too long" },
        }}
      />
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
      <InputField
        name="password"
        label="Password"
        type="password"
        placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
        autoComplete="new-password"
        register={register}
        error={errors.password}
        validation={newPasswordRules("Enter a password")}
      />
      <InputField
        name="confirmPassword"
        label="Confirm Password"
        type="password"
        placeholder="Type it again"
        autoComplete="new-password"
        register={register}
        error={errors.confirmPassword}
        validation={confirmPasswordRules(() => getValues("password"))}
      />
      <Button
        type="submit"
        disabled={isSubmitting}
        className="yellow-btn mt-5 w-full"
      >
        {isSubmitting ? "Creating account..." : "Create Account"}
      </Button>
      <FooterLink
        text="Already have an account?"
        linkText="Sign in"
        href={authPath("/sign-in", next)}
        onClick={onSwitch}
      />
    </form>
  );
};

export default SignUpForm;
