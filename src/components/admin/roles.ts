import type { Role } from "@/lib/types";

export const ROLE_LABEL: Record<Role, { label: string; tone: "neutral" | "info" | "teal" }> = {
  merchant: { label: "Merchant", tone: "neutral" }, admin: { label: "Admin", tone: "info" }, superadmin: { label: "Super admin", tone: "teal" },
};
