import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/ui/icon";
import { buttonClass, type Tone } from "@/components/ui";
import { ConfirmSubmit } from "@/components/dashboard/confirm-submit";

/** Shared server-rendered building blocks of the super admin control centre. */

export const fmtDate = (v?: string) => (v ? new Date(v).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—");
export const fmtDateTime = (v?: string) => (v ? new Date(v).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

export const STORE_TONE: Record<string, Tone> = { active: "ok", setup: "warn", suspended: "bad" };
export const KYC_TONE: Record<string, Tone> = { verified: "ok", pending: "warn", rejected: "bad", not_started: "neutral" };
export const APP_TONE: Record<string, Tone> = { published: "ok", in_review: "warn", rejected: "bad" };

/** Label / value pairs. One column on phones, two from 640px. */
export function DetailList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[150px_1fr] sm:gap-y-2.5">
      {rows.map(([k, v]) => (
        <Fragment key={k}>
          <dt className="pt-2 text-xs font-medium uppercase tracking-wide text-muted sm:pt-0 sm:text-sm sm:normal-case sm:tracking-normal">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** A one-button form posting hidden fields to a Server Action, optionally asking for confirmation first. */
export function ActionButton({ action, fields, label, confirm, variant = "secondary", size = "sm", icon, className, link }: {
  action: (fd: FormData) => Promise<void>;
  fields: Record<string, string>;
  label: ReactNode;
  confirm?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "accent";
  size?: "sm" | "md";
  icon?: IconName;
  className?: string;
  /** Render as a text link instead of a button (inside tables). */
  link?: "teal" | "bad";
}) {
  const btn = link
    ? <button className={cn("font-sans text-[13px] font-semibold hover:underline", link === "bad" ? "text-bad" : "text-teal-700", className)}>{label}</button>
    : <button className={buttonClass(variant, size, className)}>{icon && <Icon name={icon} size={15} />}{label}</button>;
  return (
    <form action={action} className={link ? "inline" : undefined}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {confirm ? <ConfirmSubmit message={confirm}>{btn}</ConfirmSubmit> : btn}
    </form>
  );
}

/** GET filter form: search box plus optional drop-downs. Stacks on phones. */
export function FilterBar({ q, placeholder, selects = [], hidden = {}, clearHref }: {
  q?: string; placeholder: string;
  selects?: { name: string; label: string; value?: string; options: [string, string][] }[];
  hidden?: Record<string, string>;
  clearHref?: string;
}) {
  const ctl = "h-11 w-full rounded-control border border-control bg-surface px-3 text-sm text-ink focus:border-teal-700 focus:outline-none";
  const active = !!q || selects.some((s) => s.value);
  return (
    <form className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="relative sm:min-w-[240px] sm:flex-1 lg:max-w-md">
        <label htmlFor="pf-q" className="sr-only">{placeholder}</label>
        <input id="pf-q" name="q" defaultValue={q} placeholder={placeholder} className={cn(ctl, "pl-10")} />
        <Icon name="search" className="absolute left-3 top-3 text-muted" />
      </div>
      {selects.map((s) => (
        <div key={s.name} className="sm:w-48">
          <label htmlFor={`pf-${s.name}`} className="sr-only">{s.label}</label>
          <select id={`pf-${s.name}`} name={s.name} defaultValue={s.value ?? ""} className={ctl}>
            <option value="">{s.label}: all</option>
            {s.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      ))}
      <div className="flex gap-2">
        <button className={buttonClass("primary", "md", "flex-1 sm:flex-none")}><Icon name="filter" size={16} />Apply</button>
        {active && clearHref && <Link href={clearHref} className={buttonClass("ghost", "md")}>Clear</Link>}
      </div>
    </form>
  );
}

/** Previous / next page links that keep the current filters. */
export function Pager({ page, pages, total, base, params }: { page: number; pages: number; total: number; base: string; params: Record<string, string | undefined> }) {
  if (pages <= 1) return <p className="text-xs text-muted">{total} result{total === 1 ? "" : "s"}</p>;
  const href = (p: number) => {
    const qs = new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `${base}?${qs.toString()}`;
  };
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Pages">
      <span className="text-muted">Page {page} of {pages} · {total} results</span>
      <div className="flex gap-2">
        {page > 1 ? <Link href={href(page - 1)} className={buttonClass("secondary", "sm")}><Icon name="chevron-left" size={15} />Previous</Link> : null}
        {page < pages ? <Link href={href(page + 1)} className={buttonClass("secondary", "sm")}>Next<Icon name="chevron-right" size={15} /></Link> : null}
      </div>
    </nav>
  );
}

/** Section card heading with an optional action on the right. */
export function CardHead({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
      <div className="min-w-0"><h2 className="font-semibold">{title}</h2>{sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}</div>
      {action}
    </div>
  );
}

export function Empty({ children, colSpan }: { children: ReactNode; colSpan: number }) {
  return <tr><td colSpan={colSpan} className="px-3 py-10 text-center text-sm text-muted">{children}</td></tr>;
}

/** Hide a table column below a breakpoint (keeps tables readable on phones). */
export const hideBelow = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" } as const;
