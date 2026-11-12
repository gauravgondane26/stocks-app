"use client";

import { use } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { toast } from "sonner";

import FooterLink from "@/components/forms/FooterLink";
import InputField from "@/components/forms/InputField";
import { Button } from "@/components/ui/button";
import { signInWithEmail } from "@/lib/actions/auth.actions";
import { authPath, safeNextPath } from "@/lib/auth-path";
import { isNextNavigation } from "@/lib/navigation-error";
import { EMAIL_PATTERN } from "@/lib/validation/auth";

// `next` is the page a guest was on when they tried something that needs an account.
const SignIn = ({ searchParams }: { searchParams: Promise<AuthSearchParams> }) => {
  const next = safeNextPath(use(searchParams).next);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
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
    <>
      <h1 className="form-title mb-3!">Welcome Back</h1>
      <p className="mb-10 text-gray-500">
        Sign in to keep a watchlist, set alerts and save your trade settings.
      </p>
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
        />
        <FooterLink text="Just looking?" linkText="Keep browsing" href={next} />
      </form>
    </>
  );
};

export default SignIn;
