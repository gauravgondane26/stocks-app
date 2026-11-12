import Header from "@/components/Header";
import HolidayDataNotice from "@/components/HolidayDataNotice";
import { requireUser } from "@/lib/better-auth/session";
import { getCurrentMarket } from "@/lib/market/current";

const layout = async ({ children }: { children: React.ReactNode }) => {
  const user = await requireUser();
  const market = await getCurrentMarket();

  return (
    <main className="min-h-screen text-gray-400">
      {/* HEADER */}
      <Header user={user} />
      <HolidayDataNotice market={market} />

      <div className="container py-10">{children}</div>
    </main>
  );
};

export default layout;
