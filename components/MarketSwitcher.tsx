"use client";

import { useTransition } from "react";

import { setMarket } from "@/lib/actions/market.actions";
import { MARKET_IDS, MARKETS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";
import { cn } from "@/lib/utils";

const MarketSwitcher = ({
  market,
  className,
}: {
  market: MarketId;
  className?: string;
}) => {
  const [isPending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label="Market"
      className={cn(
        "inline-flex items-center rounded-lg border border-gray-600 p-0.5",
        isPending && "opacity-60",
        className,
      )}
    >
      {MARKET_IDS.map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={id === market}
          disabled={isPending}
          onClick={() => {
            if (id !== market) startTransition(() => setMarket(id));
          }}
          className={cn(
            "cursor-pointer rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
            id === market
              ? "bg-yellow-500 text-gray-950"
              : "text-gray-400 hover:text-yellow-500",
          )}
        >
          {MARKETS[id].label}
        </button>
      ))}
    </div>
  );
};

export default MarketSwitcher;
