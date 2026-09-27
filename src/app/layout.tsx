import type { Metadata, Viewport } from "next";
import "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "IND2B — Create your online store", template: "%s · IND2B" },
  description: "Start an online store in minutes. Pick a template, add products, and sell with UPI, cards, COD and GST invoices. Your brand, your domain.",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
};
export const viewport: Viewport = { themeColor: "#0B5F5C" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en-IN"><body>{children}</body></html>;
}
