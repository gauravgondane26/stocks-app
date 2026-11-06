"use client";

import { useForm, type SubmitHandler } from "react-hook-form";
import { toast } from "sonner";

import FooterLink from "@/components/forms/FooterLink";
import InputField from "@/components/forms/InputField";
import { Button } from "@/components/ui/button";
import { signInWithEmail } from "@/lib/actions/auth.actions";
import { EMAIL_PATTERN } from "@/lib/validation/auth";

const SignIn = () => {
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
      const result = await signInWithEmail(data);
      if (result) toast.error(result.error);
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <>
      <h1 className="form-title">Welcome Back</h1>
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
          href="/sign-up"
        />
      </form>
    </>
  );
};

export default SignIn;
