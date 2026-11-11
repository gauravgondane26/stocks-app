import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/database/mongoose";
import { generateText } from "@/lib/ai";
import { inngest } from "@/lib/inngest/client";
import { MARKETS, marketForCountry } from "@/lib/market/markets";
import type { MarketId } from "@/lib/market/types";
import { sendWelcomeEmail } from "@/lib/nodemailer";

// The sign-up answers the intro is written from. All four come from fixed option
// lists, and the name and email are left out, so the prompt holds nothing personal.
export type WelcomeProfile = {
  country: string;
  investmentGoals: string;
  riskTolerance: string;
  preferredIndustry: string;
};

export type WelcomeIntro = { text: string; source: "ai" | "fallback" };

const MAX_INTRO_LENGTH = 600;

const INSTRUCTIONS = `You write the opening paragraph of a welcome email for OpenWatch, a read-only stock market dashboard with watchlists, price alerts, a chart scanner and day-trading planning tools. Write 2 or 3 short, friendly sentences in plain text, addressed to "you". Tie it to the reader's profile. Do not recommend, name or rank any stock, fund or sector to buy or sell, do not predict prices, and do not give financial advice. No greeting line, no sign-off, no markdown, no links.`;

const listFormat = new Intl.ListFormat("en", { type: "conjunction" });

const describeMarket = (market: MarketId) => {
  const { label, exchanges, currency } = MARKETS[market];
  return `${label} (${listFormat.format(exchanges.map(({ code }) => code))}, prices in ${currency})`;
};

export const welcomePrompt = (profile: WelcomeProfile) =>
  [
    `Market: ${describeMarket(marketForCountry(profile.country))}`,
    `Investment goal: ${profile.investmentGoals}`,
    `Risk tolerance: ${profile.riskTolerance}`,
    `Preferred industry: ${profile.preferredIndustry}`,
  ].join("\n");

export const fallbackIntro = (profile: WelcomeProfile) => {
  const { label } = MARKETS[marketForCountry(profile.country)];
  return `OpenWatch keeps the ${label} market in one place: a watchlist, price alerts, a chart scanner and trade-planning tools. You picked ${profile.investmentGoals.toLowerCase()} as your goal, ${profile.riskTolerance.toLowerCase()} risk tolerance and ${profile.preferredIndustry} as your preferred industry, so a good first step is adding the stocks you already follow to your watchlist.`;
};

// Collapses whitespace and drops markdown bold. Anything empty or too long falls
// back rather than being cut mid-sentence.
const cleanIntro = (text: string) => {
  const cleaned = text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  return cleaned && cleaned.length <= MAX_INTRO_LENGTH ? cleaned : null;
};

export const writeWelcomeIntro = async (profile: WelcomeProfile): Promise<WelcomeIntro> => {
  const result = await generateText({ instructions: INSTRUCTIONS, input: welcomePrompt(profile) });
  const text = result.ok ? cleanIntro(result.text) : null;
  if (text) return { text, source: "ai" };

  console.warn("Welcome intro fell back to plain text:", result.ok ? "unusable AI text" : result.reason);
  return { text: fallbackIntro(profile), source: "fallback" };
};

const findUser = async (userId: string, projection: Record<string, 1>) => {
  if (!Types.ObjectId.isValid(userId)) return null;
  const { connection } = await connectToDatabase();
  // Better Auth's Mongo adapter stores user ids as ObjectIds.
  return connection.db?.collection("user").findOne({ _id: new Types.ObjectId(userId) }, { projection });
};

export const findWelcomeProfile = async (userId: string): Promise<WelcomeProfile | null> => {
  const user = await findUser(userId, {
    country: 1,
    investmentGoals: 1,
    riskTolerance: 1,
    preferredIndustry: 1,
  });
  if (!user) return null;
  return {
    country: String(user.country ?? ""),
    investmentGoals: String(user.investmentGoals ?? ""),
    riskTolerance: String(user.riskTolerance ?? ""),
    preferredIndustry: String(user.preferredIndustry ?? ""),
  };
};

// Loads the contact details here, inside the send step, so they never end up in
// the job's saved step results.
export const deliverWelcomeEmail = async (userId: string, intro: string): Promise<boolean> => {
  const user = await findUser(userId, { email: 1, name: 1, country: 1 });
  if (!user?.email) return false;
  return sendWelcomeEmail({
    to: String(user.email),
    name: String(user.name ?? "there"),
    intro,
    marketLabel: MARKETS[marketForCountry(String(user.country ?? ""))].label,
  });
};

// Called after sign-up. The event id makes Inngest drop a repeat for the same user,
// and a failure is only logged so it never blocks signing up.
export const queueWelcomeEmail = async (userId: string) => {
  try {
    await inngest.send({ id: `user-created-${userId}`, name: "app/user.created", data: { userId } });
  } catch (error) {
    console.error(
      "Couldn't queue the welcome email:",
      error instanceof Error ? error.message : error,
    );
  }
};
