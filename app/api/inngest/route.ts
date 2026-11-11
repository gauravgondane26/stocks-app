import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import {
  checkAlerts,
  digestForUser,
  digestSchedulers,
  scanFunctions,
  welcomeEmail,
} from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [checkAlerts, ...scanFunctions, welcomeEmail, ...digestSchedulers, digestForUser],
});
