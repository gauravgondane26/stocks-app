"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { deleteAlert, resetAlert } from "@/lib/actions/alert.actions";

const GENERIC_ERROR = "Couldn't update your alert. Please try again.";

const AlertActions = ({
  id,
  ticker,
  canReset,
}: {
  id: string;
  ticker: string;
  canReset: boolean;
}) => {
  const [isPending, startTransition] = useTransition();

  const run = (
    action: (id: string) => Promise<AlertActionResult>,
    success: string,
  ) => {
    startTransition(async () => {
      let result: AlertActionResult;
      try {
        result = await action(id);
      } catch {
        result = { ok: false, error: GENERIC_ERROR };
      }

      if (result.ok) toast.success(success);
      else toast.error(result.error);
    });
  };

  return (
    <div className="flex gap-1">
      {canReset && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(resetAlert, `${ticker} alert is active again`)}
          aria-label={`Reset ${ticker} alert`}
          title="Reset"
          className="alert-update-btn p-2 disabled:opacity-50"
        >
          <RotateCcw className="size-4" />
        </button>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(deleteAlert, `${ticker} alert deleted`)}
        aria-label={`Delete ${ticker} alert`}
        title="Delete"
        className="alert-delete-btn p-2 disabled:opacity-50"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
};

export default AlertActions;
