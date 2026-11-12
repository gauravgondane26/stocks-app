"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import useAuthHref from "@/hooks/useAuthHref";
import { runScanNow } from "@/lib/actions/scanner.actions";

// A guest gets a link to sign in, since a scan is saved for the person who runs it.
const RunScanButton = ({
  mode,
  label,
  signedIn = true,
}: {
  mode: "daily" | "orb";
  label: string;
  signedIn?: boolean;
}) => {
  const signInHref = useAuthHref();
  const [isPending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof runScanNow>>;
      try {
        result = await runScanNow(mode);
      } catch {
        result = { ok: false, error: "The scan failed. Please try again." };
      }
      if (result.ok) toast.success("Scan finished");
      else toast.error(result.error);
    });

  if (!signedIn) {
    return (
      <Link href={signInHref} className="add-alert">
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={isPending}
      className="add-alert disabled:opacity-60"
    >
      {isPending ? "Scanning... (up to a minute)" : label}
    </button>
  );
};

export default RunScanButton;
