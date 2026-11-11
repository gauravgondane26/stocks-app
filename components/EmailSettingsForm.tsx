"use client";

import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { saveEmailSettings } from "@/lib/actions/settings.actions";

type EmailSettings = { digest: boolean; alerts: boolean };

const OPTIONS: { name: keyof EmailSettings; label: string; description: string }[] = [
  {
    name: "digest",
    label: "Daily news digest",
    description:
      "On trading days, after each market closes: new headlines for the stocks on that market's watchlist. Nothing is sent on a day with no news.",
  },
  {
    name: "alerts",
    label: "Price alert emails",
    description:
      "An email when one of your price alerts rings. With this off, alerts still ring and show on your watchlist.",
  },
];

const EmailSettingsForm = ({ settings }: { settings: EmailSettings }) => {
  const {
    formState: { isSubmitting },
    handleSubmit,
    register,
  } = useForm<EmailSettings>({ defaultValues: settings });

  const onSubmit = async (data: EmailSettings) => {
    let result: Awaited<ReturnType<typeof saveEmailSettings>>;
    try {
      result = await saveEmailSettings(data);
    } catch {
      result = { ok: false, error: "Couldn't save your email settings. Please try again." };
    }
    if (result.ok) toast.success("Email settings saved");
    else toast.error(result.error);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {OPTIONS.map(({ name, label, description }) => (
        <label
          key={name}
          htmlFor={`email-${name}`}
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-600 bg-gray-800 p-4"
        >
          <input
            id={`email-${name}`}
            type="checkbox"
            {...register(name)}
            className="mt-1 size-4 shrink-0 cursor-pointer accent-yellow-500"
          />
          <span className="space-y-1">
            <span className="block font-medium text-gray-100">{label}</span>
            <span className="block text-sm text-gray-500">{description}</span>
          </span>
        </label>
      ))}
      <button type="submit" disabled={isSubmitting} className="yellow-btn w-full px-8 sm:w-auto">
        {isSubmitting ? "Saving..." : "Save Email Settings"}
      </button>
    </form>
  );
};

export default EmailSettingsForm;
