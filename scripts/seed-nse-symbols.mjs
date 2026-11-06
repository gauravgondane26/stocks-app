// Refreshes the India search list. Run from the repo root and commit the result:
//   node scripts/seed-nse-symbols.mjs
//
// Source: NSE's published list of equities, EQUITY_L.csv.
import { writeFileSync } from "node:fs";

const SOURCE_URL =
  "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv";
const OUTPUT_PATH = "lib/market/data/nse-symbols.json";
const MIN_EXPECTED_SYMBOLS = 1000;

const response = await fetch(SOURCE_URL, {
  headers: { "User-Agent": "OpenWatch/0.1 (personal portfolio project)" },
  signal: AbortSignal.timeout(30_000),
});
if (!response.ok) {
  throw new Error(`NSE list request failed with status ${response.status}`);
}

const [header, ...rows] = (await response.text()).trim().split(/\r?\n/);
if (!header.startsWith("SYMBOL,NAME OF COMPANY,")) {
  throw new Error(`NSE list format changed: ${header}`);
}

const symbols = rows
  .map((row) => row.split(","))
  // A comma inside a company name would shift the columns, so check the shape.
  .filter((columns) => columns.length === 8 && columns[0] && columns[1])
  .map(([ticker, name]) => ({ ticker: ticker.trim(), name: name.trim() }))
  .sort((a, b) => a.ticker.localeCompare(b.ticker));

if (symbols.length < MIN_EXPECTED_SYMBOLS) {
  throw new Error(`Only parsed ${symbols.length} symbols, expected far more.`);
}

writeFileSync(
  OUTPUT_PATH,
  `${JSON.stringify(
    {
      source: SOURCE_URL,
      seededAt: new Date().toISOString().slice(0, 10),
      symbols,
    },
    null,
    1,
  )}\n`,
);
console.log(`Wrote ${symbols.length} symbols to ${OUTPUT_PATH}`);
