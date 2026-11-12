import Header from "@/components/Header";
import HolidayDataNotice from "@/components/HolidayDataNotice";
import { getCurrentUser } from "@/lib/better-auth/session";
import { getCurrentMarket } from "@/lib/market/current";

// Guests can browse. Pages that need an account call requireUser() themselves.
const layout = async ({ children }: { children: React.ReactNode }) => {
  const user = await getCurrentUser();
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
