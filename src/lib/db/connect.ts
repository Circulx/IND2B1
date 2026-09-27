import "server-only";
import mongoose from "mongoose";
import { env } from "../env";

/**
 * One shared Mongoose connection per server process (cached on globalThis so
 * hot reload in development does not open a new connection on every change).
 *
 * Authentication and TLS come from MONGODB_URI, e.g.
 *   mongodb://ind2b_app:PASSWORD@db-host:27017/?authSource=ind2b
 *   mongodb+srv://ind2b_app:PASSWORD@cluster0.xxxxx.mongodb.net      (Atlas: TLS on by default)
 * Use a database user that only has readWrite on this one database.
 */
type Cache = { conn?: Promise<typeof mongoose> };
const g = globalThis as unknown as { __ind2bMongo?: Cache };
const cache: Cache = (g.__ind2bMongo ??= {});

export async function connectDb() {
  if (!cache.conn) {
    const e = env();
    mongoose.set("strictQuery", true);          // unknown fields in filters are dropped, not passed to MongoDB
    // Unique indexes (emails, store addresses, order numbers) are part of the security model, so they are
    // built on startup. Large deployments can build them ahead of time and set MONGO_AUTO_INDEX=false.
    mongoose.set("autoIndex", process.env.MONGO_AUTO_INDEX !== "false");
    cache.conn = mongoose
      .connect(e.MONGODB_URI, {
        dbName: e.MONGODB_DB,
        serverSelectionTimeoutMS: 10_000,
        maxPoolSize: 20,
        retryWrites: true,
        appName: "ind2b",
      })
      .then(async (m) => {
        if (e.SEED_DEMO_DATA === "true") {
          const { ensureSeed } = await import("./seed");
          await ensureSeed();
        }
        return m;
      });
    cache.conn.catch(() => { cache.conn = undefined; });
  }
  return cache.conn;
}
