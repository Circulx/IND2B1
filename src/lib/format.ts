const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("en-IN");

/** Amounts are stored as integer paise everywhere; format only at the edge. */
export function formatINR(paise: number, opts: { decimals?: boolean } = {}) {
  const rupees = paise / 100;
  return (opts.decimals ? inr2 : inr).format(rupees);
}

/** ₹38.4 L / ₹6.4 Cr style for dashboards. */
export function formatINRCompact(paise: number) {
  const r = paise / 100;
  if (r >= 1e7) return `₹${(r / 1e7).toFixed(1)} Cr`;
  if (r >= 1e5) return `₹${(r / 1e5).toFixed(1)} L`;
  return inr.format(r);
}

export function formatNumber(n: number) {
  return num.format(n);
}

export function relativeDays(days: number) {
  if (days < 0) return `Overdue ${Math.abs(days)} day${days === -1 ? "" : "s"}`;
  if (days === 0) return "Due today";
  return `Due in ${days} day${days === 1 ? "" : "s"}`;
}
