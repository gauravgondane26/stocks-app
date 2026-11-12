"use client";

import { use, useEffect } from "react";
import { useForm, useWatch, type SubmitHandler } from "react-hook-form";
import { toast } from "sonner";

import CountrySelectField from "@/components/forms/CountrySelectField";
import FooterLink from "@/components/forms/FooterLink";
import InputField from "@/components/forms/InputField";
import SelectField from "@/components/forms/SelectField";
import { Button } from "@/components/ui/button";
import { signUpWithEmail } from "@/lib/actions/auth.actions";
import { authPath, safeNextPath } from "@/lib/auth-path";
import { isNextNavigation } from "@/lib/navigation-error";
import {
  INVESTMENT_GOALS,
  PREFERRED_INDUSTRIES,
  RISK_TOLERANCE_OPTIONS,
} from "@/lib/constants";
import { marketForCountry } from "@/lib/market/markets";
import {
  EMAIL_PATTERN,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/validation/auth";

// `next` is the page a guest was on when they tried something that needs an account.
const SignUp = ({ searchParams }: { searchParams: Promise<AuthSearchParams> }) => {
  const next = safeNextPath(use(searchParams).next);
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      country: "US",
      investmentGoals: "Growth",
      riskTolerance: "Medium",
      preferredIndustry: "Technology",
    },
    mode: "onBlur",
  });

  // Industries depend on the market the country maps to. When the country moves to
  // the other market, the old industry isn't in the new list, so pick its first one.
  const industries = PREFERRED_INDUSTRIES[marketForCountry(useWatch({ control, name: "country" }))];
  useEffect(() => {
    const current = getValues("preferredIndustry");
    if (!industries.some(({ value }) => value === current)) {
      setValue("preferredIndustry", industries[0].value);
    }
  }, [industries, getValues, setValue]);

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
    <>
      <h1 className="form-title">Sign Up and Personalize</h1>
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
        <CountrySelectField
          name="country"
          label="Country"
          control={control}
          error={errors.country}
          required
        />
        <SelectField
          name="investmentGoals"
          label="Investment Goals"
          placeholder="Select your goal"
          options={INVESTMENT_GOALS}
          control={control}
          error={errors.investmentGoals}
          required
        />
        <SelectField
          name="riskTolerance"
          label="Risk Tolerance"
          placeholder="Select your risk level"
          options={RISK_TOLERANCE_OPTIONS}
          control={control}
          error={errors.riskTolerance}
          required
        />
        <SelectField
          name="preferredIndustry"
          label="Preferred Industry"
          placeholder="Select your preferred industry"
          options={industries}
          control={control}
          error={errors.preferredIndustry}
          required
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
        />
        <FooterLink text="Just looking?" linkText="Keep browsing" href={next} />
      </form>
    </>
  );
};

export default SignUp;
