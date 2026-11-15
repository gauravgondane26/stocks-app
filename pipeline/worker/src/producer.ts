// `npm run producer`: every PIPELINE_POLL_MS (default 60 s), polls each open market's
// alert and watchlist stocks through getMarketData and publishes the quotes to
// quotes.us / quotes.in. `npm run producer -- --once` runs a single poll and exits.
import { getMarketData } from "@/lib/market";
import { isMarketOpen } from "@/lib/market/hours";
import { MARKET_IDS } from "@/lib/market/markets";

import { loadPollSymbols } from "./db";
import { pollMarket } from "./handlers";
import { createAdmin, createProducer, ensureTopics, onShutdown } from "./kafka";
import { encodeMessage, quoteKey } from "./messages";
import { quoteTopic } from "./topics";

const intervalMs = Number(process.env.PIPELINE_POLL_MS ?? 60_000);
const once = process.argv.includes("--once");

const admin = createAdmin("openwatch-producer-admin");
await ensureTopics(admin);
await admin.close();

const producer = createProducer("openwatch-producer");
let timer: NodeJS.Timeout | undefined;
onShutdown(async () => {
  clearTimeout(timer);
  await producer.close();
});

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const pollOpenMarkets = async () => {
  for (const market of MARKET_IDS) {
    if (!isMarketOpen(market)) continue;
    const result = await pollMarket(market, {
      loadSymbols: loadPollSymbols,
      fetchQuote: (symbol) => getMarketData(market).quote(symbol),
      publish: async (messages) => {
        await producer.send({
          messages: messages.map((message) => ({
            topic: quoteTopic(market),
            key: quoteKey(message),
            value: encodeMessage(message),
          })),
        });
      },
      pause,
      now: () => new Date(),
    });
    console.log(
      `${market}: ${result.published} of ${result.symbols} quotes published` +
        (result.failed ? `, ${result.failed} failed` : "") +
        (result.stale ? `, ${result.stale} not from today` : ""),
    );
  }
};

const loop = async () => {
  try {
    if (!MARKET_IDS.some((market) => isMarketOpen(market))) {
      console.log("No market is open; nothing to poll. (npm run replay works any time.)");
    } else {
      await pollOpenMarkets();
    }
  } catch (error) {
    console.error("Poll failed:", error);
  }

  if (once) {
    await producer.close();
    process.exit(0);
  }
  timer = setTimeout(loop, intervalMs);
};

await loop();
