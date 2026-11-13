"use client";

import { Menu } from "lucide-react";

import MarketSwitcher from "@/components/MarketSwitcher";
import NavItems from "@/components/NavItems";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { openAuth } from "@/lib/auth-events";
import type { MarketId } from "@/lib/market/types";

const SIGN_UP_CLASS =
  "cursor-pointer items-center rounded-lg bg-yellow-500 px-4 py-2 font-medium text-gray-950 transition-colors hover:bg-yellow-400";

// Header controls for someone who isn't signed in. Sign in and Create account open
// the sign-in dialog over the current page. Below lg the nav moves into a menu,
// and below md the market switcher does too, as they do in the user menu.
const GuestMenu = ({ market }: { market: MarketId }) => (
  <div className="flex items-center gap-4">
    <button
      type="button"
      onClick={() => openAuth("sign-in")}
      className="cursor-pointer font-medium whitespace-nowrap text-gray-400 transition-colors hover:text-yellow-500"
    >
      Sign in
    </button>
    <button
      type="button"
      onClick={() => openAuth("sign-up")}
      className={`hidden xl:inline-flex ${SIGN_UP_CLASS}`}
    >
      Create account
    </button>
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
          <NavItems variant="menu" signedIn={false} />
        </nav>
        <div className="px-2 py-2 md:hidden">
          <MarketSwitcher market={market} />
        </div>
        <div className="px-2 pt-2 pb-1">
          <button
            type="button"
            onClick={() => openAuth("sign-up")}
            className={`flex w-full justify-center ${SIGN_UP_CLASS}`}
          >
            Create account
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

export default GuestMenu;
