import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/database/mongoose";

// Reads chosen fields of a Better Auth user, or null for an unknown or malformed id.
// Better Auth's Mongo adapter stores user ids as ObjectIds. For background jobs
// only: it takes any user id, so it must never be reachable from a server action.
export const findUserFields = async (userId: string, projection: Record<string, 1>) => {
  if (!Types.ObjectId.isValid(userId)) return null;
  const { connection } = await connectToDatabase();
  return (
    (await connection.db
      ?.collection("user")
      .findOne({ _id: new Types.ObjectId(userId) }, { projection })) ?? null
  );
};
