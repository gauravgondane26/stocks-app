"use client";

import { NAV_ITEMS } from "@/lib/constants";
import { openSearch } from "@/lib/search-events";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINK_CLASS = "hover:text-yellow-500 transition-colors";

const NavItems = () => {
  const pathname = usePathname();
  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";

    return pathname.startsWith(path);
  };

  return (
    <ul className="flex flex-col sm:flex-row p-2 gap-3 sm:gap-10 font-medium">
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
