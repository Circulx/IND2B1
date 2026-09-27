import "server-only";
import { z } from "zod";

/**
 * Server configuration, validated once on first use. In production the app
 * refuses to run with a missing or weak secret or without a database URL,
 * instead of silently falling back to unsafe defaults.
 */
const isProd = process.env.NODE_ENV === "production";

const schema = z.object({
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, "MONGODB_URI must start with mongodb:// or mongodb+srv://"),
  MONGODB_DB: z.string().regex(/^[A-Za-z0-9_-]{1,38}$/).default("ind2b"),
  SESSION_SECRET: isProd
    ? z.string().min(32, "SESSION_SECRET must be at least 32 characters in production")
    : z.string().optional(),
  SEED_DEMO_DATA: z.enum(["true", "false"]).default(isProd ? "false" : "true"),
  CLOUDINARY_CLOUD_NAME: z.string().regex(/^[a-z0-9_-]+$/i).optional(),
  CLOUDINARY_API_KEY: z.string().regex(/^\d+$/).optional(),
  CLOUDINARY_API_SECRET: z.string().min(10).optional(),
  CLOUDINARY_FOLDER: z.string().regex(/^[a-z0-9_/-]+$/i).default("ind2b"),
  UPLOAD_DIR: z.string().default(".uploads"),
}).superRefine((v, ctx) => {
  const c = [v.CLOUDINARY_CLOUD_NAME, v.CLOUDINARY_API_KEY, v.CLOUDINARY_API_SECRET].filter(Boolean).length;
  if (c !== 0 && c !== 3) ctx.addIssue({ code: "custom", message: "Set all three CLOUDINARY_* variables, or none" });
});

export type Env = z.infer<typeof schema>;
let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const raw = Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "config"}: ${i.message}`).join("\n");
    throw new Error(`Invalid server configuration:\n${msg}\nSee .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

export const mediaProvider = () => (env().CLOUDINARY_CLOUD_NAME ? "cloudinary" : "local") as "cloudinary" | "local";
