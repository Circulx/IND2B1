#!/usr/bin/env node
/**
 * `npm run dev` — one command for the whole platform.
 *
 * - If MONGODB_URI is set (in the shell, .env or .env.local), it is used as-is.
 * - Otherwise a local MongoDB server is started for you with mongodb-memory-server,
 *   storing data in ./.mongo-data so it survives restarts. The first run downloads
 *   the MongoDB binary (~70 MB) once and caches it.
 * Then `next dev` starts on http://localhost:3000. Demo data is seeded on first use.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Load .env.local / .env (simple KEY=VALUE lines) so MONGODB_URI can live there.
for (const file of [".env.local", ".env"]) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

let mongod;
if (!process.env.MONGODB_URI) {
  let MongoMemoryServer;
  try {
    ({ MongoMemoryServer } = await import("mongodb-memory-server"));
  } catch {
    console.error("\n  MONGODB_URI is not set and mongodb-memory-server is not installed.\n  Run `npm install`, or set MONGODB_URI in .env.local (for example mongodb://127.0.0.1:27017/ind2b).\n");
    process.exit(1);
  }
  const dbPath = path.join(root, ".mongo-data");
  fs.mkdirSync(dbPath, { recursive: true });
  console.log("▸ Starting local MongoDB (data in .mongo-data)… the first run downloads MongoDB once.");
  try {
    mongod = await MongoMemoryServer.create({
      instance: { dbPath, storageEngine: "wiredTiger", port: Number(process.env.MONGO_PORT || 27027) },
    });
  } catch (e) {
    console.error(`\n  Could not start a local MongoDB: ${e?.message ?? e}\n`);
    console.error("  Fix: install MongoDB Community Server (or use a free MongoDB Atlas cluster) and put");
    console.error("       MONGODB_URI=mongodb://127.0.0.1:27017   in .env.local, then run `npm run dev` again.\n");
    process.exit(1);
  }
  process.env.MONGODB_URI = mongod.getUri();
  console.log(`▸ MongoDB ready at ${process.env.MONGODB_URI}`);
} else {
  console.log("▸ Using MONGODB_URI from your environment.");
}

const args = ["dev", ...process.argv.slice(2)];
const child = spawn(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), ...args], { stdio: "inherit", env: process.env, cwd: root });

let stopping = false;
const stop = async (code = 0) => {
  if (stopping) return;
  stopping = true;
  child.kill("SIGINT");
  if (mongod) await mongod.stop({ doCleanup: false }).catch(() => {});
  process.exit(code);
};
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
child.on("exit", (code) => stop(code ?? 0));
