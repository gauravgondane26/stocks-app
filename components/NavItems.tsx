"use client";

import { openAuth } from "@/lib/auth-events";
import { NAV_ITEMS } from "@/lib/constants";
import { openSearch } from "@/lib/search-events";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINK_CLASS = "hover:text-yellow-500 transition-colors";

// "bar" is the header row; "menu" is the column in the user and guest menus. For a
// guest, pages that need an account open the sign-in dialog, then go there.
const NavItems = ({
  variant = "bar",
  signedIn = true,
}: {
  variant?: "bar" | "menu";
  signedIn?: boolean;
}) => {
  const pathname = usePathname();
  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";

    return pathname.startsWith(path);
  };

  return (
    <ul
      className={cn(
        "flex p-2 font-medium",
        variant === "bar" ? "flex-row gap-6 xl:gap-10" : "flex-col gap-3",
      )}
    >
      {NAV_ITEMS.map(({ href, label, needsAccount }) => (
        <li key={href}>
          {href === "/search" ? (
            <button
              type="button"
              onClick={openSearch}
              className={`${LINK_CLASS} cursor-pointer`}
            >
              {label}
            </button>
          ) : needsAccount && !signedIn ? (
            <button
              type="button"
              onClick={() => openAuth("sign-in", href)}
              className={`${LINK_CLASS} cursor-pointer`}
            >
              {label}
            </button>
          ) : (
            <Link
              href={href}
              className={`${LINK_CLASS} ${isActive(href) ? "text-gray-100" : ""}`}
            >
              {label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
};

export default NavItems;
