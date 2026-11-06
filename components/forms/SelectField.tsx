"use client";

import { Controller, type FieldValues } from "react-hook-form";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SelectField = <T extends FieldValues>({
  name,
  label,
  placeholder,
  options,
  control,
  error,
  required = false,
}: SelectFieldProps<T>) => {
  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="form-label">
        {label}
      </Label>
      <Controller
        name={name}
        control={control}
        rules={{ required: required ? `Select ${label.toLowerCase()}` : false }}
        render={({ field }) => (
          <Select
            items={options}
            value={field.value ?? null}
            onValueChange={field.onChange}
          >
            <SelectTrigger
              id={name}
              onBlur={field.onBlur}
              aria-invalid={Boolean(error)}
              className="select-trigger"
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent
              alignItemWithTrigger={false}
              className="max-h-72 border-gray-600 bg-gray-800 text-white"
            >
              {options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="cursor-pointer text-white focus:bg-gray-600 focus:text-white"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {error && <p className="text-sm text-red-500">{error.message}</p>}
    </div>
  );
};

export default SelectField;
