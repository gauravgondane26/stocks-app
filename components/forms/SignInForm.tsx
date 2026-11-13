"use client";

import Link from "next/link";
import { useForm, type SubmitHandler } from "react-hook-form";
import { toast } from "sonner";

import FooterLink from "@/components/forms/FooterLink";
import InputField from "@/components/forms/InputField";
import { Button } from "@/components/ui/button";
import { signInWithEmail } from "@/lib/actions/auth.actions";
import { authPath } from "@/lib/auth-path";
import { isNextNavigation } from "@/lib/navigation-error";
import { EMAIL_FIELD_RULES } from "@/lib/validation/auth";

// Used by the /sign-in page and the sign-in dialog.
// In the dialog, `onForgot` swaps to the forgot-password form; on the page it's a link.
const SignInForm = ({
  next,
  onSwitch,
  onForgot,
}: AuthFormProps & { onForgot?: () => void }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    defaultValues: { email: "", password: "" },
    // Not on blur: an error appearing as focus leaves a field shifts the footer
    // link mid-click, so "Create one" or "Sign in" would miss.
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
        validation={EMAIL_FIELD_RULES}
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
      <div className="-mt-2 text-right text-sm">
        {onForgot ? (
          <button type="button" onClick={onForgot} className="footer-link cursor-pointer">
            Forgot password?
          </button>
        ) : (
          <Link href={authPath("/forgot-password", next)} className="footer-link">
            Forgot password?
          </Link>
        )}
      </div>
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
    </form>
  );
};

export default SignInForm;
