#!/usr/bin/env node
/**
 * `npm run db:reset` — deletes all IND2B data so demo data is seeded again on the next request.
 * With no MONGODB_URI set, it removes the local ./.mongo-data folder used by `npm run dev`
 * (stop the dev server first).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [".env.local", ".env"]) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const yes = process.argv.includes("--yes");
if (!yes) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = await rl.question(`This deletes all data in ${process.env.MONGODB_URI ? `database "${process.env.MONGODB_DB || "ind2b"}"` : ".mongo-data"}. Type "reset" to continue: `);
  rl.close();
  if (a.trim() !== "reset") { console.log("Cancelled."); process.exit(0); }
}

if (process.env.MONGODB_URI) {
  const { default: mongoose } = await import("mongoose");
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "ind2b" });
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
  console.log("Database dropped. Demo data is seeded again on the next request.");
} else {
  fs.rmSync(path.join(root, ".mongo-data"), { recursive: true, force: true });
  console.log("Removed .mongo-data. Demo data is seeded again when you run `npm run dev`.");
}
