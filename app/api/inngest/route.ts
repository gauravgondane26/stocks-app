import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import {
  checkAlerts,
  digestForUser,
  digestSchedulers,
  scanFunctions,
  welcomeEmail,
} from "@/lib/inngest/functions";

// Inngest calls this route once per step, and the scheduled scan is one long step
// (about a minute for a US breakout scan), so give it the Vercel Hobby maximum.
// The client's checkpointing maxRuntime stays at its default: it only decides when
// to stop starting new steps in a request and never cuts a running step short.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [checkAlerts, ...scanFunctions, welcomeEmail, ...digestSchedulers, digestForUser],
});
