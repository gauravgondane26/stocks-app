"use client";

import { useForm, type SubmitHandler } from "react-hook-form";

const SignUp = () => {
  const {
    register,
    handleSubmit,
    control,
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

  const onSubmit: SubmitHandler<SignUpFormData> = (data) => console.log(data);
  return (
    <>
      <h1 className="form-title"> Sign Up and Personalize</h1>
    </>
  );
};

export default SignUp;
