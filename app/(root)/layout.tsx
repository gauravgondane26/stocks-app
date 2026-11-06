import Header from "@/components/Header";
import { requireUser } from "@/lib/better-auth/session";

const layout = async ({ children }: { children: React.ReactNode }) => {
  const user = await requireUser();

  return (
    <main className="min-h-screen text-gray-400">
      {/* HEADER */}
      <Header user={user} />

      <div className="container py-10">{children}</div>
    </main>
  );
};

export default layout;
