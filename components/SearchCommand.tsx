"use client";

import { Loader2, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import useDebouncedCallback from "@/hooks/useDebouncedCallback";
import { searchStocks } from "@/lib/actions/search.actions";
import { stockPath } from "@/lib/market/symbols";
import type { StockSymbol } from "@/lib/market/types";
import { OPEN_SEARCH_EVENT } from "@/lib/search-events";

const DEBOUNCE_MS = 300;
const GENERIC_ERROR = "Search is unavailable right now.";

const SearchCommand = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [stocks, setStocks] = useState<SearchStock[]>([]);
  // The list stays up during a search, so its heading follows what produced it.
  const [isPopularList, setIsPopularList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Only the newest request may update the list, however the responses are ordered.
  const latestRequest = useRef(0);

  const runSearch = useCallback(async (value: string) => {
    const requestId = ++latestRequest.current;
    setIsLoading(true);

    let result: SearchStocksResult;
    try {
      result = await searchStocks(value);
    } catch {
      result = { ok: false, error: GENERIC_ERROR };
    }
    if (requestId !== latestRequest.current) return;

    setIsLoading(false);
    setStocks(result.ok ? result.stocks : []);
    setIsPopularList(!value.trim());
    setError(result.ok ? null : result.error);
  }, []);

  const debouncedSearch = useDebouncedCallback(runSearch, DEBOUNCE_MS);

  const changeOpen = useCallback(
    (next: boolean) => {
      setOpen(next);
      debouncedSearch.cancel();
      latestRequest.current += 1;
      setIsLoading(false);

      // Loaded on each open so it follows the market switcher and watchlist changes.
      if (next) {
        setQuery("");
        void runSearch("");
      }
    },
    [debouncedSearch, runSearch],
  );

  useEffect(() => {
    const handleOpenEvent = () => changeOpen(true);
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        changeOpen(!open);
      }
    };

    window.addEventListener(OPEN_SEARCH_EVENT, handleOpenEvent);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener(OPEN_SEARCH_EVENT, handleOpenEvent);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [changeOpen, open]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setIsLoading(true);
    debouncedSearch.run(value);
  };

  const handleSelect = (symbol: StockSymbol) => {
    changeOpen(false);
    router.push(stockPath(symbol));
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={changeOpen}
      title="Search stocks"
      description="Search for a stock in the current market."
      className="top-20 bg-gray-800 ring-gray-600 sm:max-w-2xl"
    >
      {/* The server already matched these, so cmdk mustn't filter them again. */}
      <Command shouldFilter={false} className="bg-gray-800 text-gray-400">
        <div className="relative">
          <CommandInput
            value={query}
            onValueChange={handleQueryChange}
            placeholder="Search by company or ticker"
            className="text-gray-100 placeholder:text-gray-500"
          />
          {isLoading && (
            <Loader2
              aria-label="Searching"
              className="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin text-gray-500"
            />
          )}
        </div>
        <CommandList className="max-h-[400px]">
          {!isLoading && (
            <CommandEmpty className="text-gray-500">
              {error ?? "No stocks found."}
            </CommandEmpty>
          )}
          {stocks.length > 0 && (
            <CommandGroup heading={isPopularList ? "Popular stocks" : "Results"}>
              {stocks.map(({ symbol, name, isInWatchlist }) => (
                <CommandItem
                  key={`${symbol.market}:${symbol.ticker}`}
                  value={`${symbol.market}:${symbol.ticker}`}
                  onSelect={() => handleSelect(symbol)}
                  className="cursor-pointer data-selected:bg-gray-600"
                >
                  <div className="min-w-0 flex-1">
                    <p className="search-item-name truncate">{name}</p>
                    <p className="text-sm text-gray-500">
                      {symbol.ticker} · {symbol.exchange}
                    </p>
                  </div>
                  {isInWatchlist && (
                    <Star
                      aria-label="In your watchlist"
                      className="fill-yellow-500 text-yellow-500"
                    />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
};

export default SearchCommand;
