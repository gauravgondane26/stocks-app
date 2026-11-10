import TradeSettingsForm from "@/components/TradeSettingsForm";
import { getTradeSettings } from "@/lib/actions/settings.actions";
import { requireUser } from "@/lib/better-auth/session";
import { getCurrentMarket } from "@/lib/market/current";
import { MARKETS } from "@/lib/market/markets";

const SettingsPage = async () => {
  await requireUser();

  const market = await getCurrentMarket();
  const { settings } = await getTradeSettings(market);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div>
        <h1 className="watchlist-title">
          {MARKETS[market].label} Trade Settings
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          The trade plan on each stock page checks against these. Each market
          has its own settings in its own currency: switch markets in the header
          to edit the other one. The app never places orders.
        </p>
      </div>
      {/* Keyed so switching markets resets the form to that market's values. */}
      <TradeSettingsForm key={market} market={market} settings={settings} />
    </div>
  );
};

export default SettingsPage;
