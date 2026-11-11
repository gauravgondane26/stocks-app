"use client";

import { useEffect } from "react";

// Catches errors thrown by the (root) and (auth) layouts and their pages, most often
// the database or auth service being unreachable. In production the message is a
// generic one with a digest that matches the server log, so nothing sensitive leaks.
export default function Error({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;

  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-4 py-10 text-center text-gray-400">
      <h1 className="text-2xl font-semibold text-gray-100">Data unavailable</h1>
      <p className="max-w-md">
        OpenWatch couldn&apos;t load this page. The database or a data source may be
        unreachable right now. Try again in a moment.
      </p>
      {digest && <p className="text-sm text-gray-500">Reference: {digest}</p>}
      <button type="button" onClick={() => retry()} className="yellow-btn px-6">
        Try again
      </button>
    </main>
  );
}
