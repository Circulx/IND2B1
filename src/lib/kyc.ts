import "server-only";
import mongoose from "mongoose";
import { connectDb } from "./db/connect";
import { StoreModel } from "./db/models";
import type { KycDoc } from "./types";

/**
 * KYC documents (PAN, cancelled cheque / bank proof, GST certificate) are
 * private: they are stored inside MongoDB (GridFS bucket "kycdocs"), never on a
 * public URL, and are only served through /api/kyc/:id to the store owner and
 * IND2B admins.
 */
export const KYC_MAX_BYTES = 5 * 1024 * 1024;
export const KYC_KINDS = { pan: "PAN card", bank: "Cancelled cheque or bank statement", gst: "GST certificate" } as const;
export type KycKind = keyof typeof KYC_KINDS;

const bucket = async () => {
  const m = await connectDb();
  return new mongoose.mongo.GridFSBucket(m.connection.db!, { bucketName: "kycdocs" });
};

/** Detects the real type from the first bytes; the file name and browser-sent type are ignored. */
export function sniffDocument(buf: Buffer): "application/pdf" | "image/jpeg" | "image/png" | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}

const safeName = (name: string) => name.replace(/[^\w.\- ]+/g, "_").slice(0, 80) || "document";

export async function saveKycDocument(storeId: string, kind: KycKind, filename: string, data: Buffer) {
  const contentType = sniffDocument(data);
  if (!contentType) throw new Error("kyc_type");
  if (data.length > KYC_MAX_BYTES) throw new Error("kyc_size");
  const b = await bucket();
  const id = await new Promise<string>((resolve, reject) => {
    const up = b.openUploadStream(safeName(filename), { metadata: { storeId, kind, contentType } });
    up.on("error", reject);
    up.on("finish", () => resolve(String(up.id)));
    up.end(data);
  });
  const doc: KycDoc = { fileId: id, kind, filename: safeName(filename), contentType, size: data.length, uploadedAt: new Date().toISOString() };
  // Replace any earlier file of the same kind.
  const store = await StoreModel.findById(storeId, { kycDocs: 1 }).lean();
  const old = (store?.kycDocs ?? []).filter((d) => d.kind === kind);
  await StoreModel.updateOne({ _id: storeId }, { $set: { kycDocs: [...(store?.kycDocs ?? []).filter((d) => d.kind !== kind), doc] } });
  for (const o of old) await b.delete(new mongoose.Types.ObjectId(o.fileId)).catch(() => {});
  return doc;
}

/** Reads a document with its metadata; returns null if it does not exist. */
export async function readKycDocument(fileId: string) {
  if (!/^[a-f0-9]{24}$/.test(fileId)) return null;
  const b = await bucket();
  const oid = new mongoose.Types.ObjectId(fileId);
  const [file] = await b.find({ _id: oid }).toArray();
  if (!file) return null;
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    b.openDownloadStream(oid).on("data", (c: Buffer) => chunks.push(c)).on("error", reject).on("end", () => resolve());
  });
  const meta = (file.metadata ?? {}) as { storeId?: string; kind?: string; contentType?: string };
  return { data: Buffer.concat(chunks), filename: file.filename, storeId: String(meta.storeId ?? ""), contentType: String(meta.contentType ?? "application/octet-stream") };
}
