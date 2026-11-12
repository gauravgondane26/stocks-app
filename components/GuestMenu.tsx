"use client";

import { Menu } from "lucide-react";
import Link from "next/link";

import MarketSwitcher from "@/components/MarketSwitcher";
import NavItems from "@/components/NavItems";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useAuthHref from "@/hooks/useAuthHref";
import type { MarketId } from "@/lib/market/types";

const SIGN_UP_CLASS =
  "items-center rounded-lg bg-yellow-500 px-4 py-2 font-medium text-gray-950 transition-colors hover:bg-yellow-400";

// Header links for someone who isn't signed in. Below lg the nav moves into a menu,
// and below md the market switcher does too, as they do in the user menu.
const GuestMenu = ({ market }: { market: MarketId }) => {
  const signInHref = useAuthHref("/sign-in");
  const signUpHref = useAuthHref("/sign-up");

  return (
    <div className="flex items-center gap-4">
      <Link
        href={signInHref}
        className="font-medium whitespace-nowrap text-gray-400 transition-colors hover:text-yellow-500"
      >
        Sign in
      </Link>
      <Link href={signUpHref} className={`hidden xl:inline-flex ${SIGN_UP_CLASS}`}>
        Create account
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Menu"
          className="flex cursor-pointer items-center border-none bg-transparent text-gray-400 outline-none hover:text-yellow-500 lg:hidden"
        >
          <Menu className="size-6" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-auto min-w-56 max-w-80 text-gray-400"
        >
          <nav>
            <NavItems variant="menu" />
          </nav>
          <div className="px-2 py-2 md:hidden">
            <MarketSwitcher market={market} />
          </div>
          <div className="px-2 pt-2 pb-1">
            <Link href={signUpHref} className={`flex justify-center ${SIGN_UP_CLASS}`}>
              Create account
            </Link>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default GuestMenu;
