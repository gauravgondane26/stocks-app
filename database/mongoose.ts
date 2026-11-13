import "server-only";

import mongoose, { type Model, type Schema } from "mongoose";

type MongooseCache = {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

// Stored on `global` so dev hot reloads and repeated server calls reuse one connection.
const cache: MongooseCache = (global.mongooseCache ??= {
  connection: null,
  promise: null,
});

export const connectToDatabase = async (): Promise<typeof mongoose> => {
  if (cache.connection) return cache.connection;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it to .env.local.");
  }

  cache.promise ??= mongoose.connect(uri, { bufferCommands: false });

  try {
    cache.connection = await cache.promise;
  } catch (error) {
    // Clear the failed attempt so the next request can try again.
    cache.promise = null;
    throw error;
  }

  return cache.connection;
};

// Every model getter goes through here. With bufferCommands off, a model is compiled
// only after connecting, and init() builds its unique indexes before the first write.
// mongoose.models keeps one copy across hot reloads.
export const getModel = async <T>(name: string, schema: Schema<T>): Promise<Model<T>> => {
  await connectToDatabase();

  const model = (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
  await model.init();
  return model;
};
