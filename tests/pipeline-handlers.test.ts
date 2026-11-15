import { describe, expect, it, vi } from "vitest";

import type { MarketDataResult, Quote, StockSymbol } from "@/lib/market/types";
import {
  createAlertCache,
  handleArchive,
  handleQuote,
  handleRinging,
  pollMarket,
  processThenCommit,
  type ActiveAlert,
  type EvaluatorDeps,
  type MessageOrigin,
} from "@/pipeline/worker/src/handlers";
import {
  encodeMessage,
  type QuoteMessage,
  type RingingMessage,
} from "@/pipeline/worker/src/messages";

const ALERT_ID = "6734f0c2a1b2c3d4e5f60718";
const OTHER_ID = "6734f0c2a1b2c3d4e5f60719";
// 2026-11-13 10:02 in New York.
const AS_OF = Date.parse("2026-11-13T15:02:00Z");

const quote = (changes: Partial<QuoteMessage> = {}): QuoteMessage => ({
  market: "US",
  exchange: "NASDAQ",
  ticker: "AAPL",
  price: 360.16,
  previousClose: 354.9,
  asOf: AS_OF,
  polledAt: AS_OF + 30_000,
  source: "live",
  ...changes,
});

const alert = (changes: Partial<ActiveAlert> = {}): ActiveAlert => ({
  id: ALERT_ID,
  exchange: "NASDAQ",
  ticker: "AAPL",
  type: "above",
  level: 360,
  pct: null,
  time: null,
  label: null,
  ...changes,
});

const origin: MessageOrigin = { topic: "quotes.us", partition: 1, offset: "42" };

const evaluatorDeps = (alerts: ActiveAlert[] = [alert()]) => {
  const rings: RingingMessage[] = [];
  const dlq: { raw: string | undefined; error: string; origin: MessageOrigin }[] = [];
  const deps: EvaluatorDeps = {
    alertsFor: async () => alerts,
    produceRing: async (ring) => {
      rings.push(ring);
    },
    sendToDlq: async (raw, error, from) => {
      dlq.push({ raw, error, origin: from });
    },
    alreadyRung: new Set(),
  };
  return { deps, rings, dlq };
};

describe("processThenCommit", () => {
  it("commits only after the handler has finished", async () => {
    const order: string[] = [];
    const message = { commit: () => void order.push("commit") };
    await processThenCommit(message, async () => {
      await Promise.resolve();
      order.push("handled");
    });
    expect(order).toEqual(["handled", "commit"]);
  });

  it("doesn't commit when the handler fails, so the message is read again", async () => {
    const commit = vi.fn();
    await expect(
      processThenCommit({ commit }, async () => {
        throw new Error("produce failed");
      }),
    ).rejects.toThrow("produce failed");
    expect(commit).not.toHaveBeenCalled();
  });
});

describe("pollMarket", () => {
  const symbols: StockSymbol[] = Array.from({ length: 12 }, (_, i) => ({
    market: "US",
    exchange: "NYSE",
    ticker: `T${String(i).padStart(2, "0")}`,
  }));

  const ok = (symbol: StockSymbol, asOf = AS_OF): MarketDataResult<Quote> => ({
    ok: true,
    data: {
      symbol,
      price: 100,
      previousClose: 99,
      change: 1,
      changePercent: 1.01,
      dayHigh: null,
      dayLow: null,
      volume: null,
      currency: "USD",
      asOf,
    },
  });

  it("polls in batches of 5 with a pause between, skipping failed and stale quotes", async () => {
    const published: QuoteMessage[][] = [];
    const pause = vi.fn(async () => {});
    const result = await pollMarket("US", {
      loadSymbols: async () => symbols,
      fetchQuote: async (symbol) => {
        if (symbol.ticker === "T03") return { ok: false, reason: "unavailable" };
        // Yesterday's close, as Yahoo sometimes reports right after the open.
        if (symbol.ticker === "T07") return ok(symbol, AS_OF - 24 * 60 * 60 * 1000);
        return ok(symbol);
      },
      publish: async (messages) => void published.push(messages),
      pause,
      now: () => new Date(AS_OF + 60_000),
    });

    expect(result).toEqual({ symbols: 12, published: 10, failed: 1, stale: 1 });
    expect(published.map((batch) => batch.length)).toEqual([4, 4, 2]);
    expect(pause).toHaveBeenCalledTimes(2);
    expect(published.flat().every((m) => m.source === "live" && m.polledAt === AS_OF + 60_000)).toBe(true);
  });

  it("publishes nothing when there are no stocks to poll", async () => {
    const publish = vi.fn();
    const result = await pollMarket("IN", {
      loadSymbols: async () => [],
      fetchQuote: vi.fn(),
      publish,
      pause: vi.fn(),
      now: () => new Date(AS_OF),
    });
    expect(result.published).toBe(0);
    expect(publish).not.toHaveBeenCalled();
  });
});

describe("handleQuote", () => {
  it("sends a malformed quote to the dead-letter topic with its origin, and rings nothing", async () => {
    const { deps, rings, dlq } = evaluatorDeps();
    const result = await handleQuote("{not json", origin, deps);
    expect(result).toEqual({ kind: "dead-lettered", error: "not valid JSON" });
    expect(dlq).toEqual([{ raw: "{not json", error: "not valid JSON", origin }]);
    expect(rings).toEqual([]);
  });

  it("rings an alert whose condition holds, carrying the quote's price, time and source", async () => {
    const { deps, rings } = evaluatorDeps();
    const result = await handleQuote(encodeMessage(quote()), origin, deps);
    expect(result).toEqual({ kind: "evaluated", rang: [ALERT_ID] });
    expect(rings).toHaveLength(1);
    expect(rings[0]).toMatchObject({ alertId: ALERT_ID, price: 360.16, quoteAsOf: AS_OF, source: "live" });
    expect(rings[0].message).toContain("AAPL");
  });

  it("doesn't ring when the condition doesn't hold", async () => {
    const { deps, rings } = evaluatorDeps([alert({ level: 365 })]);
    await handleQuote(encodeMessage(quote()), origin, deps);
    expect(rings).toEqual([]);
  });

  it("rings each alert once per day even if the price stays past its level", async () => {
    const { deps, rings } = evaluatorDeps();
    await handleQuote(encodeMessage(quote()), origin, deps);
    await handleQuote(encodeMessage(quote({ price: 361, asOf: AS_OF + 60_000 })), origin, deps);
    expect(rings).toHaveLength(1);
  });

  it("keeps replayed rings apart from live ones", async () => {
    const { deps, rings } = evaluatorDeps();
    await handleQuote(encodeMessage(quote({ source: "replay" })), origin, deps);
    await handleQuote(encodeMessage(quote()), origin, deps);
    expect(rings.map(({ source }) => source)).toEqual(["replay", "live"]);
  });

  it("evaluates a percent-move alert from the quote's previous close", async () => {
    const { deps, rings } = evaluatorDeps([
      // 360.16 is 1.48% above 354.9.
      alert({ id: OTHER_ID, type: "pct", level: null, pct: 1.4 }),
    ]);
    await handleQuote(encodeMessage(quote({ price: 360.16, previousClose: 354.9 })), origin, deps);
    expect(rings.map(({ alertId }) => alertId)).toEqual([OTHER_ID]);
  });
});

describe("createAlertCache", () => {
  it("loads each market at most once per TTL, grouped by stock, price rules only", async () => {
    let clock = 0;
    const load = vi.fn(async () => [
      alert(),
      alert({ id: OTHER_ID, ticker: "KO", exchange: "NYSE" }),
      alert({ id: "6734f0c2a1b2c3d4e5f6071a", type: "time", time: "10:30" }),
    ]);
    const alertsFor = createAlertCache(load, 30_000, () => clock);

    const aapl = await alertsFor("US", "NASDAQ", "AAPL");
    expect(aapl.map(({ id }) => id)).toEqual([ALERT_ID]);
    expect((await alertsFor("US", "NYSE", "KO")).map(({ id }) => id)).toEqual([OTHER_ID]);
    expect(await alertsFor("US", "NYSE", "JPM")).toEqual([]);
    expect(load).toHaveBeenCalledTimes(1);

    clock = 30_000;
    await alertsFor("US", "NASDAQ", "AAPL");
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("handleRinging", () => {
  const ring = (changes: Partial<RingingMessage> = {}): string =>
    encodeMessage({
      alertId: ALERT_ID,
      price: 360.16,
      message: "AAPL rose above $360.00",
      quoteAsOf: AS_OF,
      source: "live",
      ...changes,
    });

  it("only logs by default (dry run)", async () => {
    const ringAlert = vi.fn();
    const log = vi.fn();
    expect(await handleRinging(ring(), { ringForReal: false, ring: ringAlert, log })).toBe("dry-run");
    expect(ringAlert).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(`would ring ${ALERT_ID}: AAPL rose above $360.00`);
  });

  it("rings a live alert when ringing is turned on", async () => {
    const ringAlert = vi.fn(async () => true);
    const result = await handleRinging(ring(), { ringForReal: true, ring: ringAlert, log: vi.fn() });
    expect(result).toBe("rang");
    expect(ringAlert).toHaveBeenCalledWith({
      alertId: ALERT_ID,
      price: 360.16,
      message: "AAPL rose above $360.00",
    });
  });

  it("never rings a replayed alert, even with ringing turned on", async () => {
    const ringAlert = vi.fn(async () => true);
    const result = await handleRinging(ring({ source: "replay" }), {
      ringForReal: true,
      ring: ringAlert,
      log: vi.fn(),
    });
    expect(result).toBe("dry-run");
    expect(ringAlert).not.toHaveBeenCalled();
  });

  it("reports an alert that had already rung (redelivery, or Inngest got there first)", async () => {
    const result = await handleRinging(ring(), {
      ringForReal: true,
      ring: async () => false,
      log: vi.fn(),
    });
    expect(result).toBe("already-rang");
  });

  it("skips an invalid message without ringing", async () => {
    const ringAlert = vi.fn();
    expect(await handleRinging("nope", { ringForReal: true, ring: ringAlert, log: vi.fn() })).toBe("invalid");
    expect(ringAlert).not.toHaveBeenCalled();
  });
});

describe("handleArchive", () => {
  const deps = () => ({
    upsertLatest: vi.fn(async () => {}),
    appendIntraday: vi.fn(async () => {}),
    now: () => new Date(AS_OF + 90_000),
  });

  it("archives a live quote and updates the latest price", async () => {
    const d = deps();
    expect(await handleArchive(encodeMessage(quote()), d)).toBe("archived");
    expect(d.appendIntraday).toHaveBeenCalledWith(quote(), new Date(AS_OF + 90_000));
    expect(d.upsertLatest).toHaveBeenCalledWith(quote());
  });

  it("archives a replayed quote but never lets it replace the latest price", async () => {
    const d = deps();
    await handleArchive(encodeMessage(quote({ source: "replay" })), d);
    expect(d.appendIntraday).toHaveBeenCalledTimes(1);
    expect(d.upsertLatest).not.toHaveBeenCalled();
  });

  it("skips a malformed quote (the evaluator dead-letters it)", async () => {
    const d = deps();
    expect(await handleArchive("{}", d)).toBe("invalid");
    expect(d.appendIntraday).not.toHaveBeenCalled();
    expect(d.upsertLatest).not.toHaveBeenCalled();
  });
});
