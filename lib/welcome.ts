import "server-only";

import { generateText } from "@/lib/ai";
import { claimsLivePrices, cleanAiText, givesAdvice } from "@/lib/ai/checks";
import { inngest } from "@/lib/inngest/client";
import { describeMarket, MARKETS } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";
import { sendWelcomeEmail } from "@/lib/nodemailer";
import { findUserFields } from "@/lib/users";

export type WelcomeIntro = { text: string; source: "ai" | "fallback"; model: string | null };

const MAX_INTRO_LENGTH = 600;

const INSTRUCTIONS = `You write the opening paragraph of a welcome email for OpenWatch, a read-only stock market dashboard. Facts you may use: it has watchlists, email price alerts, a chart scanner and day-trading planning tools; its prices are delayed, so if you mention prices, call them delayed; it never places orders. Write 2 or 3 short, friendly sentences in plain text, addressed to "you", tied to the market they follow. Describe only what the reader can do with these tools, and don't claim anything is already set up or curated for them. Do not recommend, name or rank any stock, fund or sector to buy or sell, do not predict prices, and do not give financial advice. The email already greets the reader, so start straight away without "Welcome" or "Hi". No sign-off, no markdown, no links.`;

// Only the market goes to the model, so the prompt holds nothing personal.
export const welcomePrompt = (market: MarketId) => `Market: ${describeMarket(market)}`;

export const fallbackIntro = (market: MarketId) =>
  `OpenWatch keeps the ${MARKETS[market].label} market in one place: a watchlist, price alerts, a chart scanner and trade-planning tools. A good first step is adding the stocks you already follow to your watchlist.`;

// Too long or empty text is rejected rather than cut mid-sentence. A rejected
// answer goes to the next model, then to the plain fallback.
export const isUsableIntro = (text: string) => {
  const cleaned = cleanAiText(text);
  return (
    cleaned.length > 0 &&
    cleaned.length <= MAX_INTRO_LENGTH &&
    !claimsLivePrices(cleaned) &&
    !givesAdvice(cleaned)
  );
};

export const writeWelcomeIntro = async (market: MarketId): Promise<WelcomeIntro> => {
  const result = await generateText({
    instructions: INSTRUCTIONS,
    input: welcomePrompt(market),
    accept: isUsableIntro,
  });
  if (result.ok) return { text: cleanAiText(result.text), source: "ai", model: result.model };

  console.warn("Welcome intro fell back to plain text:", result.reason);
  return { text: fallbackIntro(market), source: "fallback", model: null };
};

// Loads the contact details here, inside the send step, so they never end up in
// the job's saved step results.
export const deliverWelcomeEmail = async (
  userId: string,
  intro: string,
  market: MarketId,
): Promise<boolean> => {
  const user = await findUserFields(userId, { email: 1, name: 1 });
  if (!user?.email) return false;
  return sendWelcomeEmail({
    to: String(user.email),
    name: String(user.name ?? "there"),
    intro,
    marketLabel: MARKETS[market].label,
  });
};

// Called after sign-up with the market the new user is on (their switcher choice, or
// their location). The event id makes Inngest drop a repeat for the same user, and a
// failure is only logged so it never blocks signing up.
export const queueWelcomeEmail = async (userId: string, market: MarketId) => {
  try {
    await inngest.send({
      id: `user-created-${userId}`,
      name: "app/user.created",
      data: { userId, market },
    });
  } catch (error) {
    console.error(
      "Couldn't queue the welcome email:",
      error instanceof Error ? error.message : error,
    );
  }
};
