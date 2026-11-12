// Cases from the day-trader skill's trader-alerts (alerts.py and test_alerts.py),
// Copyright (c) 2026 Jake Schincariol, MIT License (see lib/trade/LICENSE).
import { describe, expect, it } from "vitest";

import { percentMove, shouldRing } from "@/lib/alerts/evaluate";
import type { AlertRule, AlertType } from "@/lib/alerts/types";
import { isValidAlertId, validateAlert } from "@/lib/validation/alerts";

const rule = (type: AlertType, values: Partial<AlertRule> = {}): AlertRule => ({
  type,
  level: null,
  pct: null,
  time: null,
  ...values,
});

const open = { isOpen: true, time: "10:53" };
const closed = { isOpen: false, time: "08:00" };
const quote = { price: 341.27, previousClose: 340 };

describe("shouldRing", () => {
  it.each([
    ["above, price past the level", rule("above", { level: 340 }), true],
    ["above, price exactly at the level", rule("above", { level: 341.27 }), true],
    ["above, price under the level", rule("above", { level: 342 }), false],
    ["target, price past the level", rule("target", { level: 341 }), true],
    ["below, price over the level", rule("below", { level: 341 }), false],
  ])("%s", (_, alert, expected) => {
    expect(shouldRing(alert, quote, open)).toBe(expected);
  });

  it("rings a stop when the price falls through it", () => {
    expect(shouldRing(rule("stop", { level: 54 }), { price: 53.5, previousClose: 55 }, open)).toBe(true);
  });

  it("never rings a price rule without a quote", () => {
    expect(shouldRing(rule("above", { level: 1 }), null, open)).toBe(false);
  });

  it("rings a percent move in either direction", () => {
    const bac = { price: 53.67, previousClose: 54.29 };
    expect(shouldRing(rule("pct", { pct: 3 }), bac, open)).toBe(false);
    expect(shouldRing(rule("pct", { pct: 1 }), bac, open)).toBe(true);
    expect(shouldRing(rule("pct", { pct: 3 }), { price: 366.48, previousClose: 354.72 }, open)).toBe(true);
  });

  it("needs a previous close for a percent move", () => {
    expect(shouldRing(rule("pct", { pct: 1 }), { price: 10, previousClose: null }, open)).toBe(false);
    expect(percentMove({ price: 10, previousClose: null })).toBeNull();
  });

  it("rings the opening bell only while the market is open", () => {
    expect(shouldRing(rule("opening_bell"), null, open)).toBe(true);
    expect(shouldRing(rule("opening_bell"), null, closed)).toBe(false);
  });

  it("rings a time alert at or after its time, while open", () => {
    const at = (time: string) => ({ isOpen: true, time });
    expect(shouldRing(rule("time", { time: "15:55" }), null, at("15:54"))).toBe(false);
    expect(shouldRing(rule("time", { time: "15:55" }), null, at("15:55"))).toBe(true);
    expect(shouldRing(rule("time", { time: "09:00" }), null, closed)).toBe(false);
  });
});

describe("validateAlert", () => {
  const stock = { market: "US", exchange: "NASDAQ", ticker: "AAPL", company: "Apple Inc" };

  it("accepts a price alert and trims the label", () => {
    const result = validateAlert({ ...stock, type: "above", level: 250, label: "  breakout  " });
    expect(result).toMatchObject({ valid: true, data: { type: "above", level: 250, label: "breakout" } });
  });

  it("refuses a missing or non-positive level", () => {
    expect(validateAlert({ ...stock, type: "above", level: 0 }).valid).toBe(false);
    expect(validateAlert({ ...stock, type: "below", level: "250" }).valid).toBe(false);
  });

  it("refuses an unknown type", () => {
    expect(validateAlert({ ...stock, type: "sideways", level: 1 }).valid).toBe(false);
  });

  it("keeps time alerts inside the market's session", () => {
    expect(validateAlert({ ...stock, type: "time", time: "15:55" }).valid).toBe(true);
    expect(validateAlert({ ...stock, type: "time", time: "16:00" }).valid).toBe(false);
    const india = { market: "IN", exchange: "NSE", ticker: "RELIANCE", company: "Reliance Industries Limited" };
    expect(validateAlert({ ...india, type: "time", time: "09:15" }).valid).toBe(true);
    expect(validateAlert({ ...india, type: "time", time: "09:00" }).valid).toBe(false);
  });

  it("checks alert ids are Mongo object ids", () => {
    expect(isValidAlertId("6af409058427a95ade80d17d")).toBe(true);
    expect(isValidAlertId("6af409058427a95ade80d17d; drop")).toBe(false);
    expect(isValidAlertId({ $ne: null })).toBe(false);
  });
});
