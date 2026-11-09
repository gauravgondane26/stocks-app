"use client";

import { Trash2 } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import {
  addToWatchlist,
  removeFromWatchlist,
} from "@/lib/actions/watchlist.actions";
import type { StockSymbol } from "@/lib/market/types";
import { cn } from "@/lib/utils";

const GENERIC_ERROR = "Couldn't update your watchlist. Please try again.";

type WatchlistButtonProps = {
  symbol: StockSymbol;
  company: string;
  isInWatchlist: boolean;
  variant?: "button" | "icon";
};

const WatchlistButton = ({
  symbol,
  company,
  isInWatchlist,
  variant = "button",
}: WatchlistButtonProps) => {
  // Falls back to the server's value when the transition ends, so a failure undoes itself.
  const [isWatched, setIsWatched] = useOptimistic(isInWatchlist);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const next = !isWatched;

    startTransition(async () => {
      setIsWatched(next);

      let result: WatchlistActionResult;
      try {
        result = next
          ? await addToWatchlist({ ...symbol, company })
          : await removeFromWatchlist(symbol);
      } catch {
        result = { ok: false, error: GENERIC_ERROR };
      }

      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success(
          `${next ? "Added" : "Removed"} ${symbol.ticker} ${next ? "to" : "from"} your watchlist`,
        );
      }
    });
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        aria-label={`Remove ${symbol.ticker} from watchlist`}
        className="watchlist-icon-btn disabled:opacity-50"
      >
        <Trash2 className="trash-icon" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-pressed={isWatched}
      className={cn(
        "watchlist-btn px-6 disabled:opacity-70",
        isWatched && "watchlist-remove",
      )}
    >
      {isWatched ? "Remove from Watchlist" : "Add to Watchlist"}
    </button>
  );
};

export default WatchlistButton;
