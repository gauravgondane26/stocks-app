"use client";

import { useForm, type SubmitHandler } from "react-hook-form";
import { toast } from "sonner";

import FooterLink from "@/components/forms/FooterLink";
import InputField from "@/components/forms/InputField";
import { Button } from "@/components/ui/button";
import { signInWithEmail } from "@/lib/actions/auth.actions";
import { authPath } from "@/lib/auth-path";
import { isNextNavigation } from "@/lib/navigation-error";
import { EMAIL_PATTERN } from "@/lib/validation/auth";

// Used by the /sign-in page and the sign-in dialog.
const SignInForm = ({ next, onSwitch, onClose }: AuthFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    defaultValues: { email: "", password: "" },
    // Not on blur: an error appearing as focus leaves a field shifts the footer
    // links mid-click, so "Create one" or "Keep browsing" would miss.
    mode: "onSubmit",
  });

  const onSubmit: SubmitHandler<SignInFormData> = async (data) => {
    try {
      // On success the action redirects, so a returned value is always an error.
      const result = await signInWithEmail(data, next);
      if (result) toast.error(result.error);
    } catch (error) {
      if (isNextNavigation(error)) return;
      toast.error("Something went wrong. Please try again.");
    }
  };

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
        placeholder="Your password"
        autoComplete="current-password"
        register={register}
        error={errors.password}
        validation={{ required: "Enter your password" }}
      />
      <Button
        type="submit"
        disabled={isSubmitting}
        className="yellow-btn mt-5 w-full"
      >
        {isSubmitting ? "Signing in..." : "Sign In"}
      </Button>
      <FooterLink
        text="Don't have an account?"
        linkText="Create one"
        href={authPath("/sign-up", next)}
        onClick={onSwitch}
      />
      <FooterLink text="Just looking?" linkText="Keep browsing" href={next} onClick={onClose} />
    </form>
  );
};

export default SignInForm;
