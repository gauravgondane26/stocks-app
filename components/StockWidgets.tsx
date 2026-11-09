"use client";

import { useMemo } from "react";

import TradingViewWidget from "@/components/TradingViewWidget";
import {
  BASELINE_WIDGET_CONFIG,
  CANDLE_CHART_WIDGET_CONFIG,
  COMPANY_FINANCIALS_WIDGET_CONFIG,
  COMPANY_PROFILE_WIDGET_CONFIG,
  SYMBOL_INFO_WIDGET_CONFIG,
  TECHNICAL_ANALYSIS_WIDGET_CONFIG,
} from "@/lib/constants";

const SCRIPT_URL = "https://s3.tradingview.com/external-embedding/embed-widget-";

// A client component keyed on the symbol string, because configs built on the server
// would be new objects after every watchlist change and reload all six widgets.
const StockWidgets = ({ symbol }: { symbol: string }) => {
  const configs = useMemo(
    () => ({
      info: SYMBOL_INFO_WIDGET_CONFIG(symbol),
      candle: CANDLE_CHART_WIDGET_CONFIG(symbol),
      baseline: BASELINE_WIDGET_CONFIG(symbol),
      technical: TECHNICAL_ANALYSIS_WIDGET_CONFIG(symbol),
      profile: COMPANY_PROFILE_WIDGET_CONFIG(symbol),
      financials: COMPANY_FINANCIALS_WIDGET_CONFIG(symbol),
    }),
    [symbol],
  );

  return (
    <section className="grid grid-cols-1 gap-8 xl:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
        <TradingViewWidget
          scriptUrl={`${SCRIPT_URL}symbol-info.js`}
          config={configs.info}
          height={170}
        />
        <TradingViewWidget
          scriptUrl={`${SCRIPT_URL}advanced-chart.js`}
          config={configs.candle}
          className="custom-chart"
          height={600}
        />
        <TradingViewWidget
          scriptUrl={`${SCRIPT_URL}advanced-chart.js`}
          config={configs.baseline}
          className="custom-chart"
          height={600}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <TradingViewWidget
          scriptUrl={`${SCRIPT_URL}technical-analysis.js`}
          config={configs.technical}
          height={400}
        />
        <TradingViewWidget
          scriptUrl={`${SCRIPT_URL}symbol-profile.js`}
          config={configs.profile}
          height={440}
        />
        <TradingViewWidget
          scriptUrl={`${SCRIPT_URL}financials.js`}
          config={configs.financials}
          height={464}
        />
      </div>
    </section>
  );
};

export default StockWidgets;
