import "server-only";

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import type { Db } from "mongodb";

import { connectToDatabase } from "@/database/mongoose";

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to .env.local.`);
  return value;
};

// Better Auth's Mongo adapter doesn't create indexes for its unique or indexed
// fields. Without these, duplicate emails are only stopped by a check-then-insert
// and every session lookup scans the collection. createIndex is safe to repeat.
const ensureAuthIndexes = (db: Db) =>
  Promise.all([
    db.collection("user").createIndex({ email: 1 }, { unique: true }),
    db.collection("session").createIndex({ token: 1 }, { unique: true }),
    db.collection("session").createIndex({ userId: 1 }),
    db.collection("account").createIndex({ userId: 1 }),
    db.collection("account").createIndex({ providerId: 1, accountId: 1 }),
    db.collection("verification").createIndex({ identifier: 1 }),
  ]);

const createAuth = async () => {
  const { connection } = await connectToDatabase();
  if (!connection.db) throw new Error("MongoDB connection has no database.");
  await ensureAuthIndexes(connection.db);

  return betterAuth({
    appName: "OpenWatch",
    secret: requireEnv("BETTER_AUTH_SECRET"),
    baseURL: requireEnv("BETTER_AUTH_URL"),
    database: mongodbAdapter(connection.db, { client: connection.getClient() }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
    },
    // Sign-up asks only for name, email and password. Accounts made before
    // 2026-11-12 also hold country, investmentGoals, riskTolerance and
    // preferredIndustry from the old form; nothing reads them now.
    // nextCookies must stay last so it can set cookies from server actions.
    plugins: [nextCookies()],
  });
};

let authPromise: ReturnType<typeof createAuth> | undefined;

// Created on first use so that `next build` never needs a database connection.
export const getAuth = () => {
  authPromise ??= createAuth().catch((error) => {
    authPromise = undefined;
    throw error;
  });
  return authPromise;
};
