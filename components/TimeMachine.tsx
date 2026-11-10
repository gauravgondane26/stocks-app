"use client";

import { useState, useTransition } from "react";

import {
  runTimeMachineAction,
  type TimeMachineActionResult,
} from "@/lib/actions/timemachine.actions";
import { formatMoney } from "@/lib/market/format";
import type { StockSymbol } from "@/lib/market/types";
import type { StopRule } from "@/lib/trade/exit";
import { cn } from "@/lib/utils";

type RunInput = {
  entry: number;
  stop: number;
  target: number;
  stopRule: StopRule;
  entryTime: string;
  until: string;
};

const percent = (value: number) => `${(100 * value).toFixed(1)}%`;
const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(3)}`;

// Outcome colours are the app's up, down and neutral tokens. Each segment also has an
// icon and a label, so the meaning never rests on colour alone.
const OUTCOMES = [
  { key: "pTarget", label: "Target first", icon: "✓", className: "bg-teal-400" },
  { key: "pStop", label: "Stop first", icon: "✗", className: "bg-red-500" },
  { key: "pNeither", label: "Neither", icon: "–", className: "bg-gray-500" },
] as const;

const TimeMachine = ({
  symbol,
  run,
  unavailableReason,
}: {
  symbol: StockSymbol;
  run: RunInput | null;
  // Why it can't run yet, shown instead of the button.
  unavailableReason: string | null;
}) => {
  const [isPending, startTransition] = useTransition();
  const [response, setResponse] = useState<{
    input: RunInput;
    outcome: TimeMachineActionResult;
  } | null>(null);

  const money = (value: number) => formatMoney(value, symbol.market);
  const isStale =
    response !== null && JSON.stringify(response.input) !== JSON.stringify(run);

  const start = () => {
    if (!run) return;
    const input = run;
    startTransition(async () => {
      let outcome: TimeMachineActionResult;
      try {
        outcome = await runTimeMachineAction({ ...symbol, ...input });
      } catch {
        outcome = { ok: false, error: "The Time Machine couldn't run. Please try again." };
      }
      setResponse({ input, outcome });
    });
  };

  const result = response?.outcome.ok ? response.outcome.result : null;

  return (
    <div className="mt-6 border-t border-gray-700 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-100">Time Machine</h3>
          <p className="text-sm text-gray-500">
            Replays the rest of today 10,000 times from {symbol.ticker}&apos;s
            last 60 days of 5-minute bars, then runs the same rule on each of
            those real sessions.
          </p>
        </div>
        {run ? (
          <button
            type="button"
            onClick={start}
            disabled={isPending}
            className="search-btn disabled:opacity-60"
          >
            {isPending ? "Replaying..." : result && !isStale ? "Run again" : "Run the Time Machine"}
          </button>
        ) : (
          <p className="text-sm text-gray-500">{unavailableReason}</p>
        )}
      </div>

      {response && !response.outcome.ok && (
        <p className="mt-4 text-sm text-red-500">{response.outcome.error}</p>
      )}

      {result && (
        <div className={cn("mt-5 space-y-4", isStale && "opacity-50")} aria-live="polite">
          {isStale && (
            <p className="text-sm text-yellow-500">
              The plan changed since this run. Run it again for these numbers.
            </p>
          )}

          <div>
            <p className="font-medium text-gray-100">{result.verdict}</p>
            {result.notes.map((note) => (
              <p key={note} className="text-sm text-gray-400">{note}</p>
            ))}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <figure>
              <div
                className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[4px] bg-gray-800"
                role="img"
                aria-label={OUTCOMES.map(({ key, label }) => `${label} ${percent(result[key])}`).join(", ")}
              >
                {OUTCOMES.map(({ key, label, className }) =>
                  result[key] > 0 ? (
                    <div
                      key={key}
                      title={`${label}: ${percent(result[key])}`}
                      className={cn("h-full transition-opacity hover:opacity-80", className)}
                      style={{ width: `${100 * result[key]}%` }}
                    />
                  ) : null,
                )}
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {OUTCOMES.map(({ key, label, icon, className }) => (
                  <li key={key} className="flex items-center gap-2">
                    <span className={cn("inline-block size-2.5 rounded-sm", className)} aria-hidden />
                    <span className="w-4 text-gray-400" aria-hidden>{icon}</span>
                    <span className="flex-1 text-gray-400">
                      {label}
                      {key === "pNeither" && `, still open at ${result.until}`}
                    </span>
                    <span className="font-medium text-gray-100">{percent(result[key])}</span>
                  </li>
                ))}
                <li className="flex items-center gap-2 pt-1 text-gray-500">
                  <span className="flex-1">Green: target first, or above the entry at {result.until}</span>
                  <span className="text-gray-100">{percent(result.pGreen)}</span>
                </li>
              </ul>
              <figcaption className="mt-3 text-xs leading-relaxed text-gray-500">
                A simulation built from {symbol.ticker}&apos;s own last{" "}
                {result.pool.sessions} full sessions ({result.pool.from} to{" "}
                {result.pool.to}), not a prediction. Earnings, news and halts can
                do things those sessions never did.
              </figcaption>
            </figure>

            <div className="space-y-2 text-sm">
              <p className="text-gray-400">
                Price at {result.until}: median{" "}
                <span className="text-gray-100">{money(result.medianClose)}</span>, 90% of
                replays between {money(result.p5Close)} and {money(result.p95Close)}.
              </p>
              <p className="text-gray-400">
                Average R: <span className="text-gray-100">{signed(result.avgR)}</span>
              </p>
              <p className="text-gray-400">
                History: the same rule on each of those {result.history.sessions} real
                sessions fired {result.history.triggered} times
                {result.history.triggered > 0 && (
                  <>
                    : {result.history.target} target, {result.history.stop} stop,{" "}
                    {result.history.neither} neither. Average R{" "}
                    {result.history.avgR === null ? "n/a" : signed(result.history.avgR)}
                  </>
                )}
                .
              </p>
              {result.warnings.map((warning) => (
                <p key={warning} className="text-yellow-500">Note: {warning}.</p>
              ))}
              <p className="text-xs text-gray-500">
                {result.replays.toLocaleString("en-US")} replays from the entry to{" "}
                {result.until} ({result.barsLeft} five-minute bars), seed {result.seed},
                so the same plan and data give the same numbers.{" "}
                {response?.outcome.ok && `Ran in ${response.outcome.elapsedMs} ms.`} A gap
                through the stop counts as -1R here; a real fill can be worse.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeMachine;
