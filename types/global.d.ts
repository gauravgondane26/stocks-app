import type {
  Control,
  FieldError,
  FieldValues,
  Path,
  RegisterOptions,
  UseFormRegister,
} from "react-hook-form";

import type { AlertRule, AlertStatus } from "@/lib/alerts/types";
import type { StockSearchResult, StockSymbol } from "@/lib/market/types";

declare global {
  type AuthActionError = {
    error: string;
  };

  // The sign-in and sign-up pages' query string.
  type AuthSearchParams = { next?: string | string[] };

  type SignInFormData = {
    email: string;
    password: string;
  };

  type SignUpFormData = {
    fullName: string;
    email: string;
    password: string;
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
    href?: string;
    onClick?: () => void;
  };

  // Shared by the sign-in and sign-up forms. In the dialog, `onSwitch` swaps to the
  // other form; on the full pages that's a link instead.
  type AuthFormProps = {
    next: string;
    onSwitch?: () => void;
  };

  type User = {
    id: string;
    name: string;
    email: string;
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

  type AlertEntry = AlertRule & {
    id: string;
    symbol: StockSymbol;
    company: string;
    label: string | null;
    status: AlertStatus;
    rangAt: number | null;
    rangPrice: number | null;
  };

  type AlertActionResult = { ok: true } | { ok: false; error: string };

  type AlertsReadResult = { ok: true; data: AlertEntry[] } | { ok: false };
}

export {};
