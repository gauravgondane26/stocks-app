"use client";

import type { FieldValues } from "react-hook-form";

import SelectField from "@/components/forms/SelectField";
import { COUNTRY_OPTIONS } from "@/lib/countries";

const CountrySelectField = <T extends FieldValues>({
  name,
  label,
  control,
  error,
  required,
}: CountrySelectProps<T>) => {
  return (
    <SelectField
      name={name}
      label={label}
      placeholder="Select your country"
      options={COUNTRY_OPTIONS}
      control={control}
      error={error}
      required={required}
    />
  );
};

export default CountrySelectField;
