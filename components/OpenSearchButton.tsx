"use client";

import { openSearch } from "@/lib/search-events";

const OpenSearchButton = ({ label }: { label: string }) => (
  <button type="button" onClick={openSearch} className="search-btn">
    {label}
  </button>
);

export default OpenSearchButton;
