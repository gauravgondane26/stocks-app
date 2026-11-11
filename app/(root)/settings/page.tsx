import EmailSettingsForm from "@/components/EmailSettingsForm";
import TradeSettingsForm from "@/components/TradeSettingsForm";
import { getEmailSettings, getTradeSettings } from "@/lib/actions/settings.actions";
import { requireUser } from "@/lib/better-auth/session";
import { getCurrentMarket } from "@/lib/market/current";
import { MARKETS } from "@/lib/market/markets";

const SettingsPage = async () => {
  await requireUser();

  const market = await getCurrentMarket();
  const [{ settings }, email] = await Promise.all([getTradeSettings(market), getEmailSettings()]);

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

      <section id="email" className="space-y-4 border-t border-gray-600 pt-8">
        <div>
          <h2 className="watchlist-title">Emails</h2>
          <p className="mt-2 text-sm text-gray-500">
            These apply to both markets.
            {!email.loaded && " Your saved choices couldn't be loaded, so both are shown as on."}
          </p>
        </div>
        <EmailSettingsForm settings={email.settings} />
      </section>
    </div>
  );
};

export default SettingsPage;
