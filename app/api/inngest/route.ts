import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import { checkAlerts, scanFunctions } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [checkAlerts, ...scanFunctions],
});
