// `npm run replay -- --market IN [--date 2026-11-12] [--speed 60] [--symbols NSE:ITC,NSE:TCS]`
//
// Replays a past session's 5-minute bars through quotes.us / quotes.in, so every
// consumer sees it like a live session, at any hour. Each quote is marked
// source: "replay": the notifier never rings it and the archiver never lets it replace
// current prices. Without --symbols it uses the stocks the producer would poll (active
// price alerts and watchlists); without --date, the latest finished session. Yahoo keeps
// 5-minute bars for 60 days, so older dates aren't available.
import { parseArgs } from "node:util";

import { getMarketData } from "@/lib/market";
import { getMarketClock, isMarketOpen } from "@/lib/market/hours";
import { isMarketId } from "@/lib/market/markets";

import { loadPollSymbols } from "./db";
import { QUOTE_BATCH_PAUSE_MS, QUOTE_BATCH_SIZE } from "./handlers";
import { createAdmin, createProducer, ensureTopics, onShutdown } from "./kafka";
import { encodeMessage, quoteKey } from "./messages";
import {
  latestCompleteSession,
  parseSymbolList,
  planReplay,
  sessionDates,
  type StockBars,
} from "./replay-plan";
import { quoteTopic } from "./topics";

const { values } = parseArgs({
  options: {
    market: { type: "string" },
    date: { type: "string" },
    speed: { type: "string", default: "60" },
    symbols: { type: "string" },
  },
});

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const market = isMarketId(values.market?.toUpperCase())
  ? (values.market!.toUpperCase() as "US" | "IN")
  : fail("Pass --market US or --market IN.");
const speed = Number(values.speed);
if (!(speed > 0)) fail("--speed must be a positive number (60 replays 5 minutes in 5 seconds).");

const symbols = values.symbols
  ? parseSymbolList(market, values.symbols)
  : await loadPollSymbols(market);
if (symbols.length === 0) {
  fail(`No ${market} stocks on any watchlist or price alert. Pass --symbols, for example NSE:ITC,NSE:TCS.`);
}

console.log(`Fetching 5-minute bars for ${symbols.length} ${market} stock(s)...`);
const stocks: StockBars[] = [];
for (let start = 0; start < symbols.length; start += QUOTE_BATCH_SIZE) {
  if (start > 0) await new Promise((resolve) => setTimeout(resolve, QUOTE_BATCH_PAUSE_MS));
  const batch = symbols.slice(start, start + QUOTE_BATCH_SIZE);
  const results = await Promise.all(
    batch.map((symbol) => getMarketData(market).bars(symbol, { interval: "5m", range: "60d" })),
  );
  results.forEach((result, index) => {
    if (result.ok) stocks.push({ symbol: batch[index], bars: result.data });
    else console.warn(`  ${batch[index].exchange}:${batch[index].ticker}: bars ${result.reason}`);
  });
}

const dates = sessionDates(market, stocks);
const today = getMarketClock(market).date;
const date = values.date ?? latestCompleteSession(dates, today, isMarketOpen(market));
if (!date) fail("No finished session in the data yet.");
if (!dates.includes(date!)) {
  fail(
    `No bars for ${date}. Available: ${dates[0] ?? "none"} to ${dates.at(-1) ?? "none"} ` +
      "(Yahoo keeps 60 days of 5-minute bars; weekends and holidays have none).",
  );
}

const plan = planReplay(market, date!, stocks, speed);
console.log(
  `Replaying ${market} ${plan.date}: ${plan.quoteCount} quotes in ${plan.steps.length} steps, ` +
    `about ${Math.ceil(plan.durationMs / 1000)} s at ${speed}x` +
    (plan.missing.length ? `. No bars that day for ${plan.missing.join(", ")}` : ""),
);

const admin = createAdmin("openwatch-replay-admin");
await ensureTopics(admin);
await admin.close();

const producer = createProducer("openwatch-replay");
onShutdown(() => producer.close());

const started = Date.now();
for (const [index, step] of plan.steps.entries()) {
  const wait = started + step.offsetMs - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

  const polledAt = Date.now();
  await producer.send({
    messages: step.quotes.map((quote) => ({
      topic: quoteTopic(market),
      key: quoteKey(quote),
      value: encodeMessage({ ...quote, polledAt }),
    })),
  });

  if (index % 12 === 0 || index === plan.steps.length - 1) {
    const { time } = getMarketClock(market, new Date(step.quotes[0].asOf));
    console.log(`  ${time} ${market} time: ${step.quotes.length} quote(s) (step ${index + 1}/${plan.steps.length})`);
  }
}

await producer.close();
console.log("Replay finished.");
process.exit(0);
