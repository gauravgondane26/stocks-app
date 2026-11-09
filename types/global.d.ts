import type {
  Control,
  FieldError,
  FieldValues,
  Path,
  RegisterOptions,
  UseFormRegister,
} from "react-hook-form";

import type { StockSearchResult, StockSymbol } from "@/lib/market/types";

declare global {
  type AuthActionError = {
    error: string;
  };

  type SignInFormData = {
    email: string;
    password: string;
  };

  type SignUpFormData = {
    fullName: string;
    email: string;
    password: string;
    country: string;
    investmentGoals: string;
    riskTolerance: string;
    preferredIndustry: string;
  };

  type CountrySelectProps<T extends FieldValues> = {
    name: Path<T>;
    label: string;
    control: Control<T>;
    error?: FieldError;
    required?: boolean;
  };

  type FormInputProps<T extends FieldValues> = {
    name: Path<T>;
    label: string;
    placeholder: string;
    type?: string;
    register: UseFormRegister<T>;
    error?: FieldError;
    validation?: RegisterOptions<T, Path<T>>;
    disabled?: boolean;
    autoComplete?: string;
  };

  type Option = {
    value: string;
    label: string;
  };

  type SelectFieldProps<T extends FieldValues> = {
    name: Path<T>;
    label: string;
    placeholder: string;
    options: readonly Option[];
    control: Control<T>;
    error?: FieldError;
    required?: boolean;
  };

  type FooterLinkProps = {
    text: string;
    linkText: string;
    href: string;
  };

  type WelcomeEmailData = {
    email: string;
    name: string;
    intro: string;
  };

  type User = {
    id: string;
    name: string;
    email: string;
    country: string;
  };

  type SearchStock = StockSearchResult & {
    isInWatchlist: boolean;
  };

  type SearchStocksResult =
    | { ok: true; stocks: SearchStock[] }
    | { ok: false; error: string };

  type WatchlistEntry = {
    symbol: StockSymbol;
    company: string;
    addedAt: number;
  };

  type WatchlistActionResult = { ok: true } | { ok: false; error: string };

  type WatchlistReadResult =
    | { ok: true; data: WatchlistEntry[] }
    | { ok: false };

  type FinnhubSearchResult = {
    symbol: string;
    description: string;
    displaySymbol?: string;
    type: string;
  };

  type FinnhubSearchResponse = {
    count: number;
    result: FinnhubSearchResult[];
  };

  type QuoteData = {
    c?: number;
    dp?: number;
  };

  type ProfileData = {
    name?: string;
    marketCapitalization?: number;
  };

  type FinancialsData = {
    metric?: { [key: string]: number };
  };

  type SelectedStock = {
    symbol: string;
    company: string;
    currentPrice?: number;
  };

  type AlertsListProps = {
    alertData: Alert[] | undefined;
  };

  type MarketNewsArticle = {
    id: number;
    headline: string;
    summary: string;
    source: string;
    url: string;
    datetime: number;
    category: string;
    related: string;
    image?: string;
  };

  type WatchlistNewsProps = {
    news?: MarketNewsArticle[];
  };

  type AlertData = {
    symbol: string;
    company: string;
    alertName: string;
    alertType: "upper" | "lower";
    threshold: string;
  };

  type AlertModalProps = {
    alertId?: string;
    alertData?: AlertData;
    action?: string;
    open: boolean;
    setOpen: (open: boolean) => void;
  };

  type RawNewsArticle = {
    id: number;
    headline?: string;
    summary?: string;
    source?: string;
    url?: string;
    datetime?: number;
    image?: string;
    category?: string;
    related?: string;
  };

  type Alert = {
    id: string;
    symbol: string;
    company: string;
    alertName: string;
    currentPrice: number;
    alertType: "upper" | "lower";
    threshold: number;
    changePercent?: number;
  };
}

export {};
