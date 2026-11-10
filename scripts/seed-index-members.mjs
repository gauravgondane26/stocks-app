// Refreshes the scanner's index lists. Run from the repo root and commit the result:
//   node scripts/seed-index-members.mjs
//
// Source: the constituents tables on Wikipedia's "List of S&P 500 companies" and
// "NIFTY 50" pages. Index members change a few times a year, so rerun it now and then.
import { writeFileSync } from "node:fs";

const OUTPUT_PATH = "lib/market/data/index-members.json";
const USER_AGENT = "OpenWatch/0.1 (personal portfolio project)";

const INDICES = {
  US: {
    name: "S&P 500",
    page: "List_of_S%26P_500_companies",
    tickerColumn: "Symbol",
    nameColumn: "Security",
    min: 495,
    max: 510,
  },
  IN: {
    name: "NIFTY 50",
    page: "NIFTY_50",
    tickerColumn: "Symbol",
    nameColumn: "Company name",
    min: 50,
    max: 50,
  },
};

const decode = (html) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .trim();

const readTable = async ({ page, tickerColumn, nameColumn }) => {
  const url = `https://en.wikipedia.org/api/rest_v1/page/html/${page}`;
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${page} request failed with status ${response.status}`);
  const html = await response.text();

  const marker = html.indexOf('id="constituents"');
  if (marker < 0) throw new Error(`${page} has no constituents table any more`);
  const table = html.slice(html.lastIndexOf("<table", marker), html.indexOf("</table>", marker));

  const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/g)]
    .map(([row]) => [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(([, cell]) => decode(cell)))
    .filter((cells) => cells.length > 1);
  const [header, ...body] = rows;
  const tickerIndex = header.indexOf(tickerColumn);
  const nameIndex = header.indexOf(nameColumn);
  if (tickerIndex < 0 || nameIndex < 0) {
    throw new Error(`${page} table columns changed: ${header.join(", ")}`);
  }

  return {
    source: url.replace("/api/rest_v1/page/html/", "/wiki/"),
    members: body
      .map((cells) => ({ ticker: cells[tickerIndex], name: cells[nameIndex] }))
      .filter(({ ticker }) => /^[A-Z0-9&.-]{1,20}$/.test(ticker))
      .sort((a, b) => a.ticker.localeCompare(b.ticker)),
  };
};

const output = { seededAt: new Date().toISOString().slice(0, 10) };
for (const [market, index] of Object.entries(INDICES)) {
  const { source, members } = await readTable(index);
  if (members.length < index.min || members.length > index.max) {
    throw new Error(`${index.name}: parsed ${members.length} members, expected ${index.min} to ${index.max}`);
  }
  output[market] = { index: index.name, source, members };
  console.log(`${index.name}: ${members.length} members`);
}

writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 1)}\n`);
console.log(`Wrote ${OUTPUT_PATH}`);
