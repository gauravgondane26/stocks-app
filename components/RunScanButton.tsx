"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { runScanNow } from "@/lib/actions/scanner.actions";

const RunScanButton = ({ mode, label }: { mode: "daily" | "orb"; label: string }) => {
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
