"use client";

import { useActionState } from "react";
import type { CheckoutState } from "@/actions/storefront";

type Props = { action: (prev: CheckoutState, fd: FormData) => Promise<CheckoutState>; token: string; online: boolean; cod: boolean; states: string[]; totalLabel: string };

export function CheckoutForm({ action, token, online, cod, states, totalLabel }: Props) {
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(action, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  const input = "h-12 w-full rounded-control border border-control px-3 focus:border-[var(--store-primary)] focus:outline-none";
  const field = (id: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <input id={id} name={id} defaultValue={v[id]} aria-invalid={!!e[id]} aria-describedby={e[id] ? `${id}-err` : undefined} className={input} {...props} />
      {e[id] && <span id={`${id}-err`} className="text-xs text-bad">{e[id]}</span>}
    </div>
  );
  const methods = [
    ...(online ? [["upi", "UPI", "Google Pay, PhonePe, Paytm or any UPI app"], ["card", "Debit / credit card", "Visa, Mastercard, RuPay"], ["netbanking", "Net-banking", "All major banks"]] : []),
    ...(cod ? [["cod", "Cash on delivery", "Pay when your order arrives"]] : []),
  ];
  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="checkoutToken" value={token} />
      {e.form && <p role="alert" className="rounded-card bg-bad-50 p-3 text-sm text-bad">{e.form}</p>}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Contact</h2>
        {field("email", "Email", { type: "email", autoComplete: "email" })}
        {field("phone", "Mobile number", { type: "tel", autoComplete: "tel", placeholder: "98220 41736" })}
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Delivery address</h2>
        {field("name", "Full name", { autoComplete: "name" })}
        {field("address", "Address", { autoComplete: "street-address", placeholder: "House no., street, area" })}
        <div className="grid gap-4 sm:grid-cols-3">
          {field("city", "City", { autoComplete: "address-level2" })}
          {field("pincode", "Pincode", { inputMode: "numeric", maxLength: 6, autoComplete: "postal-code" })}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="state" className="text-sm font-medium">State</label>
            <select id="state" name="state" defaultValue={v.state ?? ""} className={input}><option value="" disabled>Choose</option>{states.map((s) => <option key={s}>{s}</option>)}</select>
            {e.state && <span className="text-xs text-bad">{e.state}</span>}
          </div>
        </div>
      </section>
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2 text-lg font-semibold">Payment</legend>
        {methods.map(([val, label, sub], i) => (
          <label key={val} className="flex items-start gap-3 rounded-card border border-line bg-white p-4 has-[:checked]:border-2 has-[:checked]:border-[var(--store-primary)]">
            <input type="radio" name="payment" value={val} defaultChecked={v.payment ? v.payment === val : i === 0} className="mt-1" />
            <span><b className="text-sm">{label}</b><br /><span className="text-xs text-muted">{sub}</span></span>
          </label>
        ))}
        {e.payment && <span className="text-xs text-bad">{e.payment}</span>}
      </fieldset>
      <button disabled={pending} className="h-14 text-base font-semibold disabled:opacity-60" style={{ background: "var(--store-primary)", color: "var(--store-on-primary)", borderRadius: "var(--store-radius)" }}>
        {pending ? "Placing order…" : `Pay ${totalLabel}`}
      </button>
      <p className="text-center text-xs text-muted">Payments are processed securely by Razorpay. Your card details never reach this store.</p>
    </form>
  );
}
