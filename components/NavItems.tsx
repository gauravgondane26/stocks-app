"use client";

import { NAV_ITEMS } from "@/lib/constants";
import { openSearch } from "@/lib/search-events";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINK_CLASS = "hover:text-yellow-500 transition-colors";

// "bar" is the header row; "menu" is the column in the user and guest menus.
const NavItems = ({ variant = "bar" }: { variant?: "bar" | "menu" }) => {
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
      {NAV_ITEMS.map(({ href, label }) => (
        <li key={href}>
          {href === "/search" ? (
            <button
              type="button"
              onClick={openSearch}
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
