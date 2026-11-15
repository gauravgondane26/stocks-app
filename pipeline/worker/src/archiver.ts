// `npm run archiver`: consumer group quote-archiver. The second reader of the same
// quotes.* topics as the evaluator, with its own offsets: it saves every quote to
// openwatch_pipeline.intraday_quotes and keeps openwatch_pipeline.latest_quotes current.
// Stop it for a while and it catches up from its last committed offset.
import { appendIntradayQuote, upsertLatestQuote } from "./db";
import { handleArchive } from "./handlers";
import { runConsumer } from "./kafka";
import { CONSUMER_GROUPS, QUOTE_TOPICS } from "./topics";

let archived = 0;

await runConsumer({
  clientId: "openwatch-archiver",
  groupId: CONSUMER_GROUPS.archiver,
  topics: Object.values(QUOTE_TOPICS),
  startAt: "earliest",
  handle: async (message) => {
    const result = await handleArchive(message.value, {
      upsertLatest: upsertLatestQuote,
      appendIntraday: appendIntradayQuote,
      now: () => new Date(),
    });
    if (result === "archived" && ++archived % 100 === 0) {
      console.log(`${archived} quotes archived`);
    }
  },
});
