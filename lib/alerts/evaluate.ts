// Rule logic ported from trader-alerts/alerts.py in
// https://github.com/Jakeschincariol/day-trader-skill
//
// MIT License
//
// Copyright (c) 2026 Jake Schincariol
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import type {
  AlertQuote,
  AlertRule,
  MarketClock,
} from "@/lib/alerts/types";

export const percentMove = ({ price, previousClose }: AlertQuote) =>
  previousClose ? 100 * (price / previousClose - 1) : null;

// Pure: no database or network. The original re-rings percent, time and bell rules
// each trading day. Here every alert rings once until it is reset, and the caller
// only passes alerts that are still active.
export const shouldRing = (
  alert: AlertRule,
  quote: AlertQuote | null,
  clock: MarketClock,
): boolean => {
  if (alert.type === "opening_bell") return clock.isOpen;
  if (alert.type === "time") {
    // "HH:MM" strings compare correctly as text.
    return clock.isOpen && alert.time !== null && clock.time >= alert.time;
  }

  if (!quote) return false;

  if (alert.type === "pct") {
    const move = percentMove(quote);
    return move !== null && alert.pct !== null && Math.abs(move) >= alert.pct;
  }

  if (alert.level === null) return false;
  return alert.type === "above" || alert.type === "target"
    ? quote.price >= alert.level
    : quote.price <= alert.level;
};
