import { Banner } from "@/components/ui";

/** Messages shown after a super admin action redirects back (?ok=… or ?error=…). */
const OK: Record<string, string> = {
  store_status: "Store status updated.",
  plan: "Plan saved.",
  kyc_approve: "KYC approved. The merchant is verified.",
  kyc_reject: "KYC rejected. The merchant sees your reason in their dashboard.",
  kyc_reset: "KYC reset. The merchant can submit documents again.",
  store_deleted: "Store and all of its data were deleted permanently.",
  domain_verify: "Custom domain marked as verified. The store is now served on it.",
  domain_unverify: "Custom domain set back to pending.",
  domain_remove: "Custom domain removed.",
  app_install: "Plugin installed on the store.",
  app_uninstall: "Plugin removed from the store.",
  order_status: "Order status changed.",
  payment_status: "Payment status changed.",
  product_active: "Product published.",
  product_draft: "Product moved to draft. It no longer shows on the storefront.",
  product_deleted: "Product deleted.",
  discount_toggle: "Discount code switched.",
  discount_delete: "Discount code deleted.",
  user_enable: "Account enabled. The user can sign in again.",
  user_disable: "Account disabled and signed out of every device.",
  user_make_admin: "Role changed to admin. The user was signed out and gets the new role at next sign-in.",
  user_make_superadmin: "Promoted to super admin. The user was signed out and gets the new role at next sign-in.",
  user_signout: "Signed out of every device.",
  user_deleted: "Account deleted.",
  device_signed_out: "Device signed out.",
  others_signed_out: "All your other devices were signed out.",
  shopper_enable: "Shopper account enabled.",
  shopper_disable: "Shopper account disabled and signed out.",
  shopper_signout: "Shopper signed out of every device.",
  shopper_delete: "Shopper account deleted. Their past orders are kept.",
  app_published: "Plugin approved and listed in the app store.",
  app_rejected: "Plugin rejected. The developer sees your note.",
  app_in_review: "Plugin sent back to review and hidden from the app store.",
  session_revoked: "Session ended.",
  bulk_merchants: "Every merchant was signed out.",
  bulk_staff: "Every other staff session was ended.",
  bulk_shoppers: "Every shopper was signed out.",
  bulk_everyone: "Everyone except you was signed out.",
};

const ERROR: Record<string, string> = {
  invalid: "That request was not valid. Refresh the page and try again.",
  not_found: "That record no longer exists.",
  self: "You cannot do that to your own account. Ask another super admin.",
  last_superadmin: "This is the last active super admin. Add another super admin first.",
  not_staff: "Merchant accounts cannot be turned into staff. Create a separate staff account.",
  owns_stores: "This merchant still owns stores. Transfer or delete the stores first.",
  reason_required: "Give a reason when suspending a store. The merchant sees it.",
  note_required: "Add a note explaining the rejection.",
  unknown_app: "This plugin is not published, so it cannot be installed.",
  status_changed: "Someone else changed this order a moment ago. Check it and try again.",
  restock_failed: "Order status changed, but its items could not be returned to stock. Ask the merchant to correct the stock.",
  failed: "Something went wrong. Please try again.",
};

export function Flash({ sp }: { sp: { ok?: string; error?: string } }) {
  if (sp.ok && OK[sp.ok]) return <div data-flash="ok" role="status"><Banner tone="ok" icon="check-circle">{OK[sp.ok]}</Banner></div>;
  if (sp.error) return <div data-flash="error" role="alert"><Banner tone="warn" icon="alert">{ERROR[sp.error] ?? ERROR.failed}</Banner></div>;
  return null;
}
