import Image from "next/image";
import Link from "next/link";
import { getCurrentMarket } from "@/lib/market/current";
import MarketSwitcher from "./MarketSwitcher";
import NavItems from "./NavItems";
import UserDropdown from "./UserDropdown";

const Header = async ({ user }: { user: User }) => {
  const market = await getCurrentMarket();

  return (
    <header className="sticky top-0 header">
      <div className="container header-wrapper">
        <Link href="/">
          <Image
            src="/assets/icons/logo.svg"
            alt="OpenWatch logo"
            width={191}
            height={32}
            className="h-8 w-auto cursor-pointer"
          />
        </Link>
        <nav className="hidden sm:block">
          <NavItems />
        </nav>
        <div className="flex items-center gap-4">
          {/* Below md there isn't room, so it moves into the user menu. */}
          <MarketSwitcher market={market} className="hidden md:inline-flex" />
          <UserDropdown user={user} market={market} />
        </div>
      </div>
    </header>
  );
};

export default Header;
