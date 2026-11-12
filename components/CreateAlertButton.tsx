"use client";

import { Bell } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import InputField from "@/components/forms/InputField";
import SelectField from "@/components/forms/SelectField";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createAlert } from "@/lib/actions/alert.actions";
import { openAuth } from "@/lib/auth-events";
import { describeAlert } from "@/lib/alerts/describe";
import { alertValueKind, type AlertRule } from "@/lib/alerts/types";
import { ALERT_TYPE_OPTIONS } from "@/lib/constants";
import { MARKETS } from "@/lib/market/markets";
import type { StockSymbol } from "@/lib/market/types";
import { cn } from "@/lib/utils";

const GENERIC_ERROR = "Couldn't save your alert. Please try again.";

type AlertFormData = {
  type: AlertRule["type"];
  level: string;
  pct: string;
  time: string;
  label: string;
};

const DEFAULT_VALUES: AlertFormData = {
  type: "above",
  level: "",
  pct: "",
  time: "",
  label: "",
};

const CreateAlertButton = ({
  symbol,
  company,
  className,
  signedIn = true,
}: {
  symbol: StockSymbol;
  company: string;
  className?: string;
  // A guest gets the sign-in dialog, which comes back to this page.
  signedIn?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<AlertFormData>({ defaultValues: DEFAULT_VALUES });

  const market = MARKETS[symbol.market];
  const kind = alertValueKind(useWatch({ control, name: "type" }));

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) reset(DEFAULT_VALUES);
  };

  const onSubmit = async ({ type, level, pct, time, label }: AlertFormData) => {
    const rule: AlertRule = {
      type,
      level: kind === "level" ? Number(level) : null,
      pct: kind === "pct" ? Number(pct) : null,
      time: kind === "time" ? time : null,
    };

    let result: AlertActionResult;
    try {
      result = await createAlert({ ...symbol, company, ...rule, label });
    } catch {
      result = { ok: false, error: GENERIC_ERROR };
    }

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Alert set for ${symbol.ticker}: ${describeAlert(rule, symbol.market)}`,
    );
    changeOpen(false);
  };

  if (!signedIn) {
    return (
      <button
        type="button"
        onClick={() => openAuth("sign-in")}
        className={cn("add-alert", className)}
      >
        <Bell className="size-4" />
        Add Alert
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => changeOpen(true)}
        aria-label={`Set an alert for ${symbol.ticker}`}
        className={cn("add-alert", className)}
      >
        <Bell className="size-4" />
        Add Alert
      </button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="bg-gray-800 text-gray-400 ring-gray-600 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="alert-title">
              Alert for {symbol.ticker}
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              {company}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <SelectField
              name="type"
              label="Alert type"
              placeholder="Choose a type"
              options={ALERT_TYPE_OPTIONS}
              control={control}
              error={errors.type}
              required
            />
            {kind === "level" && (
              <InputField
                name="level"
                label={`Price (${market.currency})`}
                placeholder="0.00"
                type="number"
                register={register}
                error={errors.level}
                validation={{
                  required: "Enter a price.",
                  validate: (value) =>
                    Number(value) > 0 || "Enter a price above zero.",
                }}
              />
            )}
            {kind === "pct" && (
              <InputField
                name="pct"
                label="Percent move, up or down"
                placeholder="3"
                type="number"
                register={register}
                error={errors.pct}
                validation={{
                  required: "Enter a percentage.",
                  validate: (value) =>
                    Number(value) > 0 || "Enter a percentage above zero.",
                }}
              />
            )}
            {kind === "time" && (
              <InputField
                name="time"
                label={`Time (${market.timeZone}, ${market.open} to ${market.close})`}
                placeholder={market.open}
                type="time"
                register={register}
                error={errors.time}
                validation={{ required: "Choose a time." }}
              />
            )}
            <InputField
              name="label"
              label="Label (optional)"
              placeholder="Why this alert matters"
              register={register}
              error={errors.label}
              validation={{
                maxLength: { value: 80, message: "Keep it under 80 characters." },
              }}
            />
            <p className="text-xs text-gray-500">
              Alerts are checked every 5 minutes while the market is open, and
              quotes can be delayed, so one may arrive up to about 15 minutes
              late. Each alert rings once. It&apos;s information only and never
              places an order.
            </p>
            <button
              type="submit"
              disabled={isSubmitting}
              className="yellow-btn w-full"
            >
              {isSubmitting ? "Saving..." : "Set Alert"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreateAlertButton;
