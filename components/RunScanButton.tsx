"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { runScanNow } from "@/lib/actions/scanner.actions";
import { openAuth } from "@/lib/auth-events";

// A guest gets the sign-in dialog, since a scan is saved for the person who runs it.
const RunScanButton = ({
  mode,
  label,
  signedIn = true,
}: {
  mode: "daily" | "orb";
  label: string;
  signedIn?: boolean;
}) => {
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
      <button type="button" onClick={() => openAuth("sign-in")} className="add-alert">
        {label}
      </button>
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
