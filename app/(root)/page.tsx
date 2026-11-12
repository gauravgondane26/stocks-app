import TradingViewWidget from "@/components/TradingViewWidget";
import { getCurrentMarket } from "@/lib/market/current";
import { getDashboardConfig } from "@/lib/market/dashboard";

const Home = async () => {
  const market = await getCurrentMarket();
  const { overview, heatmap, topStories, quotes } = getDashboardConfig(market);

  const scriptUrl =
    "https://s3.tradingview.com/external-embedding/embed-widget-";
  return (
    // The key replaces the widgets on a market switch, since each one only reads
    // its config when its script loads.
    <div key={market} className="flex min-h-screen home-wrapper">
      <p className="w-full pb-6 text-sm text-gray-500">
        Market data may be delayed and is for information only.
      </p>
      <section className="grid w-full gap-8 home-section">
        <div className="md:col-span-1 xl:col-span-1">
          <TradingViewWidget
            title="Market Overview"
            scriptUrl={`${scriptUrl}market-overview.js`}
            config={overview}
            className="custom-chart"
            height={600}
          />
        </div>
        <div className="md:col-span-1 xl:col-span-2">
          <TradingViewWidget
            title="Stock Heatmap"
            scriptUrl={`${scriptUrl}stock-heatmap.js`}
            config={heatmap}
            height={600}
          />
        </div>
      </section>
      <section className="grid w-full gap-8 home-section">
        <div className="h-full md:col-span-1 xl:col-span-1">
          <TradingViewWidget
            scriptUrl={`${scriptUrl}timeline.js`}
            config={topStories}
            className="custom-chart"
            height={600}
          />
        </div>
        <div className="h-full md:col-span-1 xl:col-span-2">
          <TradingViewWidget
            scriptUrl={`${scriptUrl}market-quotes.js`}
            config={quotes}
            height={600}
          />
        </div>
      </section>
    </div>
  );
};

export default Home;
