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
  EMAIL_PATTERN,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/validation/auth";

// Used by the /sign-up page and the sign-in dialog.
const SignUpForm = ({ next, onSwitch }: AuthFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
    // Not on blur: an error appearing as focus leaves a field shifts the footer
    // link mid-click, so "Create one" or "Sign in" would miss.
    mode: "onSubmit",
  });

  const onSubmit: SubmitHandler<SignUpFormData> = async (data) => {
    try {
      // On success the action redirects, so a returned value is always an error.
      const result = await signUpWithEmail(data, next);
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
        validation={{
          required: "Enter your email",
          pattern: {
            value: EMAIL_PATTERN,
            message: "Enter a valid email address",
          },
        }}
      />
      <InputField
        name="password"
        label="Password"
        type="password"
        placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
        autoComplete="new-password"
        register={register}
        error={errors.password}
        validation={{
          required: "Enter a password",
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
