"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import MarketSwitcher from "@/components/MarketSwitcher";
import NavItems from "@/components/NavItems";
import { signOut } from "@/lib/actions/auth.actions";
import type { MarketId } from "@/lib/market/types";
import { isNextNavigation } from "@/lib/navigation-error";
import { getInitials } from "@/lib/utils";

const UserDropdown = ({
  user,
  market,
}: {
  user: User;
  market: MarketId;
}) => {
  const initials = getInitials(user.name);

  const handleSignOut = async () => {
    try {
      // On success the action redirects, so a returned value is always an error.
      const result = await signOut();
      if (result) toast.error(result.error);
    } catch (error) {
      if (isNextNavigation(error)) return;
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-3 text-gray-400 hover:text-yellow-500 cursor-pointer bg-transparent border-none outline-none">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-yellow-500 text-yellow-900 text-sm font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="hidden md:flex flex-col items-start">
          <span className="text-base font-medium text-gray-400">
            {user.name}
          </span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-auto min-w-56 max-w-80 text-gray-400"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex relative items-center gap-3 py-2">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-yellow-500 text-yellow-900 text-sm font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-base font-medium text-gray-400">
                  {user.name}
                </span>
                <span className="text-sm text-gray-500 break-all">{user.email}</span>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-gray-600" />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-gray-100 text-md font-medium focus:bg-transparent focus:text-yellow-500 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4 mr-2 hidden sm:block" />
          Logout
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-gray-600 lg:hidden" />
        <nav className="lg:hidden">
          <NavItems variant="menu" />
        </nav>
        <div className="px-2 py-2 md:hidden">
          <MarketSwitcher market={market} />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
export default UserDropdown;
