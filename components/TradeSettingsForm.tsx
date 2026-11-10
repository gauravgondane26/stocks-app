"use client";

import { useForm } from "react-hook-form";
import { toast } from "sonner";

import InputField from "@/components/forms/InputField";
import { saveTradeSettings } from "@/lib/actions/settings.actions";
import { MARKETS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";
import type { TradeSettings } from "@/lib/trade/settings";

type FormData = Record<keyof TradeSettings, string>;

const toForm = (settings: TradeSettings): FormData => ({
  accountSize: settings.accountSize?.toString() ?? "",
  maxLossPerTrade: settings.maxLossPerTrade?.toString() ?? "",
  maxDailyLoss: settings.maxDailyLoss?.toString() ?? "",
  maxTradesPerDay: settings.maxTradesPerDay.toString(),
  minRewardRisk: settings.minRewardRisk.toString(),
  noEntriesBefore: settings.noEntriesBefore,
  noEntriesAfter: settings.noEntriesAfter,
  flatBy: settings.flatBy,
});

const TradeSettingsForm = ({
  market,
  settings,
}: {
  market: MarketId;
  settings: TradeSettings;
}) => {
  const { currency, timeZone, open, close } = MARKETS[market];
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<FormData>({ defaultValues: toForm(settings) });

  const onSubmit = async (data: FormData) => {
    let result: Awaited<ReturnType<typeof saveTradeSettings>>;
    try {
      result = await saveTradeSettings({ market, ...data });
    } catch {
      result = { ok: false, error: "Couldn't save your settings. Please try again." };
    }
    if (result.ok) toast.success(`${MARKETS[market].label} trade settings saved`);
    else toast.error(result.error);
  };

  // Empty is allowed and means "not set".
  const money = (label: string, optional: boolean) => ({
    label: `${label} (${currency})${optional ? ", optional" : ""}`,
    validation: {
      validate: (value: string) =>
        value === "" || Number(value) > 0 || "Enter an amount above zero.",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-100">Money</h2>
        <p className="text-sm text-gray-500">
          The trade plan needs your account size and max loss per trade before
          it can size a position. Leave the daily loss limit empty to skip that
          check.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <InputField name="accountSize" type="number" placeholder="Not set" register={register} error={errors.accountSize} {...money("Account size", false)} />
          <InputField name="maxLossPerTrade" type="number" placeholder="Not set" register={register} error={errors.maxLossPerTrade} {...money("Max loss per trade", false)} />
          <InputField name="maxDailyLoss" type="number" placeholder="Not set" register={register} error={errors.maxDailyLoss} {...money("Daily loss limit", true)} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-100">Limits</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <InputField
            name="maxTradesPerDay"
            label="Max trades a day"
            type="number"
            placeholder="3"
            register={register}
            error={errors.maxTradesPerDay}
            validation={{ required: "Enter a number." }}
          />
          <InputField
            name="minRewardRisk"
            label="Minimum reward to risk"
            type="number"
            placeholder="1"
            register={register}
            error={errors.minRewardRisk}
            validation={{ required: "Enter a number." }}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-100">Times</h2>
        <p className="text-sm text-gray-500">
          In {timeZone} time. The session runs {open} to {close}. Flat-by is
          when you&apos;re out, win or lose, with no overnight hold.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <InputField name="noEntriesBefore" label="No entries before" type="time" placeholder={open} register={register} error={errors.noEntriesBefore} validation={{ required: "Choose a time." }} />
          <InputField name="noEntriesAfter" label="No entries after" type="time" placeholder={close} register={register} error={errors.noEntriesAfter} validation={{ required: "Choose a time." }} />
          <InputField name="flatBy" label="Flat by" type="time" placeholder={close} register={register} error={errors.flatBy} validation={{ required: "Choose a time." }} />
        </div>
      </section>

      <button type="submit" disabled={isSubmitting} className="yellow-btn w-full px-8 sm:w-auto">
        {isSubmitting ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
};

export default TradeSettingsForm;
