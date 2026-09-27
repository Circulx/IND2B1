import "server-only";
import { createHash } from "node:crypto";

/**
 * A short fingerprint of saved data. Used as a React `key` on edit forms so the
 * form re-mounts with the saved values after a Server Action updates them.
 */
export const versionKey = (data: unknown) => createHash("sha1").update(JSON.stringify(data)).digest("base64url").slice(0, 12);
