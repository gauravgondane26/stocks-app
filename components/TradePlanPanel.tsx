"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import TimeMachine from "@/components/TimeMachine";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/market/format";
import { MARKETS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";
import type { EntryResult } from "@/lib/trade/entry";
import {
  computeExitPlan,
  resolveFlatBy,
  type StopRule,
} from "@/lib/trade/exit";
import { checkRisk } from "@/lib/trade/risk";
import { getSessionTimes } from "@/lib/trade/session";
import type { TradeSettings } from "@/lib/trade/settings";
import { sizeTrade } from "@/lib/trade/size";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  "pre-open": "NOT OPEN YET",
  forming: "RANGE FORMING",
  closed: "MARKET CLOSED",
  triggered: "TRIGGERED",
  waiting: "WAITING",
  expired: "EXPIRED",
  "no-data": "NO DATA",
};

const STOP_OPTIONS: { value: StopRule; label: string }[] = [
  { value: "or_mid", label: "Opening-range midpoint" },
  { value: "or_low", label: "Opening-range low" },
  { value: "pct", label: "Percent under the entry" },
  { value: "atr", label: "Multiple of the ATR" },
  { value: "price", label: "A price" },
];

const STOP_PARAM_LABELS: Partial<Record<StopRule, string>> = {
  pct: "Percent",
  atr: "ATR multiple",
  price: "Stop price",
};

const toNumber = (value: string) => {
  const number = Number(value);
  return value.trim() !== "" && Number.isFinite(number) ? number : null;
};

const Row = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-gray-700 py-2 last:border-b-0">
    <span className="text-sm text-gray-500">{label}</span>
    <span className="text-right">
      <span className="font-medium text-gray-100">{value}</span>
      {note && <span className="block text-xs text-gray-500">{note}</span>}
    </span>
  </div>
);

const Field = ({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-xs text-gray-500">
      {label}
    </Label>
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 border-gray-600 bg-gray-900 text-gray-100"
    />
  </div>
);

export type TradePlanPanelProps = {
  market: MarketId;
  ticker: string;
  exchange: string;
  entry: EntryResult;
  barsAvailable: boolean;
  settings: TradeSettings;
  settingsSaved: boolean;
  // A price under 15 minutes old, or null.
  latestPrice: number | null;
  clock: { date: string; time: string; isTradingDay: boolean };
};

const TradePlanPanel = ({
  market,
  ticker,
  exchange,
  entry,
  barsAvailable,
  settings,
  settingsSaved,
  latestPrice,
  clock,
}: TradePlanPanelProps) => {
  const money = (value: number) => formatMoney(value, market);
  const hasRange = entry.openingRange !== null && entry.openingRange.complete;
  const plannedEntry = entry.trigger?.price ?? (hasRange ? entry.level : null);

  const [entryInput, setEntryInput] = useState(plannedEntry?.toString() ?? "");
  const [stopRule, setStopRule] = useState<StopRule>(hasRange ? "or_mid" : "pct");
  const [stopParam, setStopParam] = useState("");
  const [targetR, setTargetR] = useState("2");
  const [tradesToday, setTradesToday] = useState("0");
  const [lossToday, setLossToday] = useState("0");

  const statusKey = ["pre-open", "forming", "closed"].includes(entry.phase)
    ? entry.phase
    : entry.status;

  const result = useMemo(() => {
    const format = (value: number) => formatMoney(value, market);
    const session = getSessionTimes(market, clock.date);
    const entryPrice = toNumber(entryInput);
    if (entryPrice === null) return { prompt: "Enter a planned entry price." };

    const exit = computeExitPlan({
      entry: entryPrice,
      stopRule,
      stopParam: toNumber(stopParam),
      targetR: toNumber(targetR) ?? 0,
      openingRange: hasRange ? entry.openingRange : null,
      // An ATR stop uses the bars up to the entry bar, when there is one.
      atrBars: entry.trigger
        ? entry.bars.filter(({ slot }) => slot <= entry.trigger!.barIndex)
        : entry.bars,
    });
    if (!exit.ok) return { error: `No plan: ${exit.reason}.` };

    const isTriggerEntry = entry.trigger !== null && entryPrice === entry.trigger.price;
    const flat = resolveFlatBy(
      settings.flatBy,
      session,
      isTriggerEntry ? entry.trigger!.time : null,
    );
    if (!flat.ok) return { error: `No plan: ${flat.reason}.`, plan: exit.plan };

    const { accountSize, maxLossPerTrade } = settings;
    if (accountSize === null || maxLossPerTrade === null) {
      return { plan: exit.plan, flat };
    }

    const sizing = sizeTrade({
      entry: exit.plan.entry,
      stop: exit.plan.stop,
      target: exit.plan.target,
      latestPrice,
      accountSize,
      maxLossPerTrade,
      minRewardRisk: settings.minRewardRisk,
      formatMoney: format,
    });
    const risk = checkRisk({
      sizing,
      stop: exit.plan.stop,
      target: exit.plan.target,
      settings: { ...settings, accountSize, maxLossPerTrade },
      tradesToday: Math.max(0, Math.floor(toNumber(tradesToday) ?? 0)),
      lossToday: Math.max(0, toNumber(lossToday) ?? 0),
      clock: { isTradingDay: clock.isTradingDay, time: clock.time, session },
      formatMoney: format,
    });
    return { plan: exit.plan, flat, sizing, risk };
  }, [
    entryInput,
    stopRule,
    stopParam,
    targetR,
    tradesToday,
    lossToday,
    market,
    clock,
    entry,
    hasRange,
    settings,
    latestPrice,
  ]);

  const stopOptions = STOP_OPTIONS.filter(
    ({ value }) => hasRange || (value !== "or_mid" && value !== "or_low"),
  );

  return (
    <section className="rounded-lg border border-gray-600 bg-gray-800 p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold text-gray-100">Trade plan</h2>
        <p className="text-xs text-gray-500">
          Opening-range breakout, 15-minute range, 5-minute bars. Delayed data,
          as of {clock.time} {MARKETS[market].label} time.
        </p>
      </div>

      <div className="mt-4 rounded-md bg-gray-900 p-4">
        <p className="text-sm">
          <span
            className={cn(
              "mr-2 font-semibold",
              entry.status === "triggered" ? "text-teal-400" : "text-yellow-500",
            )}
          >
            {STATUS_LABELS[statusKey]}
          </span>
          <span className="text-gray-400">
            {barsAvailable
              ? entry.status === "triggered" && entry.trigger
                ? `${entry.trigger.time} at ${money(entry.trigger.price)}: ${entry.reason}.`
                : `${entry.reason}.`
              : "Intraday price bars are unavailable right now."}
          </span>
        </p>
        {entry.openingRange && (
          <p className="mt-1 text-sm text-gray-500">
            Opening range: high {money(entry.openingRange.high)}, low{" "}
            {money(entry.openingRange.low)} ({entry.openingRange.bars} of{" "}
            {entry.openingRange.of} bars). Entries {entry.window.noEntriesBefore}{" "}
            to {entry.window.noEntriesAfter}.
          </p>
        )}
        {entry.forming && entry.status === "waiting" && (
          <p className="mt-1 text-sm text-gray-500">
            The {entry.forming.barStart} bar is still forming (
            {money(entry.forming.price)} so far, closes {entry.forming.closes}).
            It doesn&apos;t count until it closes.
          </p>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Field id="plan-entry" label={entry.trigger ? "Entry (trigger)" : "Planned entry"} value={entryInput} onChange={setEntryInput} placeholder="0.00" />
        <div className="col-span-2 space-y-1.5 md:col-span-1 lg:col-span-2">
          <Label htmlFor="plan-stop-rule" className="text-xs text-gray-500">
            Stop
          </Label>
          <Select
            items={stopOptions}
            value={stopRule}
            onValueChange={(value) => value && setStopRule(value as StopRule)}
          >
            <SelectTrigger id="plan-stop-rule" className="h-10! w-full border-gray-600 bg-gray-900 text-gray-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="border-gray-600 bg-gray-800 text-white">
              {stopOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="cursor-pointer text-white focus:bg-gray-600 focus:text-white">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {STOP_PARAM_LABELS[stopRule] && (
          <Field id="plan-stop-param" label={STOP_PARAM_LABELS[stopRule]!} value={stopParam} onChange={setStopParam} />
        )}
        <Field id="plan-target" label="Target (R multiple)" value={targetR} onChange={setTargetR} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-100">Exit</h3>
          {result.plan ? (
            <div>
              <Row label="Entry" value={money(result.plan.entry)} />
              <Row label="Stop" value={money(result.plan.stop)} note={[result.plan.stopLabel, result.plan.stopDetail].filter(Boolean).join(": ")} />
              <Row label="Target" value={money(result.plan.target)} note={result.plan.targetLabel} />
              <Row label="Risk a share" value={money(result.plan.riskPerShare)} note={`${result.plan.riskPct}% of the entry`} />
              <Row label="Reward:risk" value={result.plan.rewardRisk.toFixed(2)} />
              {result.flat && (
                <Row
                  label="Flat by"
                  value={`${result.flat.flatBy} market time`}
                  note={result.flat.moved ? "moved up for today's early close" : "win or lose, no overnight hold"}
                />
              )}
            </div>
          ) : null}
          {"prompt" in result && <p className="text-sm text-gray-500">{result.prompt}</p>}
          {result.error && <p className="text-sm text-red-500">{result.error}</p>}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-100">Size</h3>
          {result.sizing ? (
            <div>
              <Row label="Shares" value={String(result.sizing.shares)} note={`bound by your ${result.sizing.boundBy === "max loss" ? "max loss per trade" : "account size"}`} />
              <Row label="Cost" value={money(result.sizing.cost)} note={result.sizing.entryFrom === "price" ? `at the latest price ${money(result.sizing.entry)}, above the plan's entry` : undefined} />
              <Row label="Loss if the stop fills" value={money(result.sizing.lossAtStop)} />
              {result.sizing.refusal && <p className="mt-2 text-sm text-red-500">{result.sizing.refusal}</p>}
            </div>
          ) : (
            result.plan && (
              <p className="text-sm text-gray-500">
                Set your account size and max loss per trade in{" "}
                <Link href="/settings" className="text-yellow-500 hover:underline">Settings</Link>{" "}
                to size this trade.
              </p>
            )
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-100">Risk check</h3>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <Field id="plan-trades-today" label="Trades taken today" value={tradesToday} onChange={setTradesToday} />
            <Field id="plan-loss-today" label={`Loss already at risk (${MARKETS[market].currency})`} value={lossToday} onChange={setLossToday} />
          </div>
          {result.risk ? (
            <>
              <p className={cn("text-lg font-bold", result.risk.verdict === "PASS" ? "text-teal-400" : "text-red-500")}>
                {result.risk.verdict}
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {result.risk.checks.map((check) => (
                  <li key={check.name} className="flex gap-2">
                    <span className={check.ok ? "text-teal-400" : "text-red-500"}>
                      {check.ok ? "✓" : "✗"}
                    </span>
                    <span>
                      <span className="text-gray-100">{check.name}</span>{" "}
                      <span className="text-gray-500">{check.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-gray-500">Runs once the trade is planned and sized.</p>
          )}
        </div>
      </div>

      <TimeMachine
        symbol={{ market, exchange, ticker }}
        run={
          entry.trigger && result.plan && result.flat
            ? {
                entry: result.plan.entry,
                stop: result.plan.stop,
                target: result.plan.target,
                stopRule,
                entryTime: entry.trigger.time,
                until: result.flat.flatBy,
              }
            : null
        }
        unavailableReason={
          entry.trigger
            ? "Plan the trade above to replay it."
            : "Runs once today's setup has triggered, since it replays from the entry bar."
        }
      />

      {!settingsSaved && (
        <p className="mt-5 text-sm text-gray-500">
          Using default limits.{" "}
          <Link href="/settings" className="text-yellow-500 hover:underline">Review your trade settings</Link>.
        </p>
      )}
      <p className="mt-5 border-t border-gray-700 pt-4 text-xs leading-relaxed text-gray-500">
        Not financial advice. This is a simulation, not a prediction, and most
        day traders lose money. A stop is a plan, not a guarantee: a gap or a
        fast market can fill past it. OpenWatch never places orders, and{" "}
        {ticker} prices here are delayed. Adapted from the MIT-licensed
        day-trader skill by Jake Schincariol.
      </p>
    </section>
  );
};

export default TradePlanPanel;
