import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";

/* ------------------------------------------------------------------ Button */
type Variant = "primary" | "secondary" | "accent" | "ghost" | "danger";
type Size = "md" | "sm" | "lg";

const variants: Record<Variant, string> = {
  primary: "border-transparent bg-teal-700 text-white hover:bg-teal-800",
  secondary: "bg-surface text-ink border-control hover:bg-subtle",
  accent: "border-transparent bg-saffron-700 text-white hover:brightness-95",
  ghost: "border-transparent bg-transparent text-teal-700 hover:bg-teal-50",
  danger: "bg-surface text-bad border-[#e6b8b3] hover:bg-bad-50",
};
const sizes: Record<Size, string> = { sm: "h-9 px-3 text-[13px]", md: "h-11 px-[18px] text-sm", lg: "h-12 px-6 text-[15px]" };

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control border font-semibold transition-colors",
    "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-neutral-50 disabled:text-muted",
    variants[variant], sizes[size], extra,
  );
}

type ButtonBase = { variant?: Variant; size?: Size; icon?: IconName; children?: ReactNode; className?: string };

export function Button({ variant, size, icon, children, className, ...rest }: ButtonBase & ComponentProps<"button">) {
  return (
    <button className={buttonClass(variant, size, className)} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 17} />}
      {children}
    </button>
  );
}

/**
 * Link styled as a button. `external` renders a plain <a> (full page load),
 * used for store links that open on another host.
 */
export function ButtonLink({ href, external, variant, size, icon, children, className }: ButtonBase & { href: string; external?: boolean }) {
  const cls = buttonClass(variant, size, className);
  const inner = (<>{icon && <Icon name={icon} size={size === "sm" ? 15 : 17} />}{children}</>);
  return external ? <a href={href} className={cls}>{inner}</a> : <Link href={href} className={cls}>{inner}</Link>;
}

export function IconButton({ icon, label, className, ...rest }: { icon: IconName; label: string } & ComponentProps<"button">) {
  return (
    <button aria-label={label} className={cn("inline-flex size-11 items-center justify-center rounded-control text-ink hover:bg-subtle", className)} {...rest}>
      <Icon name={icon} size={20} />
    </button>
  );
}

/* ------------------------------------------------------------------ Status */
export type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "teal";
const tones: Record<Tone, string> = {
  ok: "bg-ok-50 text-ok", warn: "bg-warn-50 text-warn", bad: "bg-bad-50 text-bad",
  info: "bg-info-50 text-info", neutral: "bg-neutral-50 text-neutral-700", teal: "bg-teal-50 text-teal-700",
};

/** Status is always colour + text, never colour alone. */
export function StatusPill({ tone, children, dot = true, className }: { tone: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold", tones[tone], className)}>
      {dot && <span className="size-[7px] rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Count({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-50 px-1.5 text-[11px] font-semibold text-neutral-700">{children}</span>;
}

export function Chip({ active, children, className }: { active?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium",
      active ? "border-teal-700 bg-teal-50 text-teal-700" : "border-control bg-surface text-ink-2", className)}>{children}</span>
  );
}

/* ------------------------------------------------------------------ Surfaces */
export function Card({ className, children, ...rest }: ComponentProps<"div">) {
  return <div className={cn("rounded-card border border-line bg-surface", className)} {...rest}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted", className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-1.5 text-[13px] text-muted">{eyebrow}</div>}
        <h1 className="text-[28px] font-bold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

export function KpiCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: IconName }) {
  return (
    <Card className="flex flex-col gap-2 p-[18px]">
      <div className="flex items-center justify-between"><span className="text-xs font-medium text-muted">{label}</span>{icon && <Icon name={icon} size={16} className="text-teal-700" />}</div>
      <span className="font-display text-[26px] font-bold tabular">{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </Card>
  );
}

export function Progress({ value, tone = "teal", label }: { value: number; tone?: "teal" | "warn" | "bad"; label?: string }) {
  const color = tone === "teal" ? "bg-teal-700" : tone === "warn" ? "bg-warn" : "bg-bad";
  return (
    <div className="h-1.5 rounded-full bg-neutral-50" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn("h-1.5 rounded-full", color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function ImagePlaceholder({ label = "Product photo", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-control bg-[#e7eae4] font-mono text-[11px] uppercase tracking-wider text-[#7a838c]", className)} role="img" aria-label={label}>
      {label}
    </div>
  );
}

/** An uploaded image, or the labelled placeholder when there is none yet. */
export function Img({ src, alt, label, className, eager }: { src?: string; alt?: string; label?: string; className?: string; eager?: boolean }) {
  if (!src) return <ImagePlaceholder label={label ?? ""} className={className} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt ?? label ?? ""} loading={eager ? "eager" : "lazy"} decoding="async" className={cn("rounded-control bg-[#e7eae4] object-cover", className)} />;
}

export function Banner({ tone = "warn", icon = "alert", children, action }: { tone?: "warn" | "info" | "ok"; icon?: IconName; children: ReactNode; action?: ReactNode }) {
  const t = tone === "warn" ? "bg-saffron-50 border-[#e9c9a6] text-warn" : tone === "info" ? "bg-info-50 border-[#b9cde6] text-info" : "bg-ok-50 border-[#bfdcc9] text-ok";
  return (
    <Card className={cn("flex items-center gap-3.5 px-[18px] py-3.5", t)}>
      <Icon name={icon} size={20} />
      <div className="flex-1 text-sm text-ink">{children}</div>
      {action}
    </Card>
  );
}

/* ------------------------------------------------------------------ Forms */
export function Field({ label, htmlFor, hint, error, children, className }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">{label}</label>
      {children}
      {error ? <span className="text-xs text-bad">{error}</span> : hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

const control = "w-full rounded-control border border-control bg-surface px-3 text-sm text-ink placeholder:text-[#8a939b] focus:border-teal-700 focus:outline-none";
export function Input({ className, mono, ...rest }: ComponentProps<"input"> & { mono?: boolean }) {
  return <input className={cn(control, "h-11", mono && "font-mono", className)} {...rest} />;
}
export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 resize-y py-2.5", className)} {...rest} />;
}
export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return <select className={cn(control, "h-11", className)} {...rest}>{children}</select>;
}

export function SearchInput({ placeholder, name = "q", defaultValue, className }: { placeholder: string; name?: string; defaultValue?: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <label htmlFor={`search-${name}`} className="sr-only">{placeholder}</label>
      <input id={`search-${name}`} name={name} defaultValue={defaultValue} placeholder={placeholder} className={cn(control, "h-11 pl-10")} />
      <Icon name="search" className="absolute left-3 top-3 text-muted" />
    </div>
  );
}

/* ------------------------------------------------------------------ Table */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-x-auto", className)}><table className="w-full border-collapse text-sm">{children}</table></div>;
}
export function Th({ children, right, className }: { children?: ReactNode; right?: boolean; className?: string }) {
  return <th scope="col" className={cn("whitespace-nowrap border-b border-line bg-subtle px-3 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted", right && "text-right", className)}>{children}</th>;
}
export function Td({ children, right, mono, className, colSpan }: { children?: ReactNode; right?: boolean; mono?: boolean; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn("border-b border-line-soft px-3 py-3 align-middle", right && "text-right", (mono || right) && "font-mono tabular whitespace-nowrap", className)}>{children}</td>;
}

/* ------------------------------------------------------------------ Tabs (link-based, server friendly) */
export function Tabs({ items }: { items: { label: string; href: string; count?: number | string; active?: boolean }[] }) {
  return (
    <nav className="flex gap-6 overflow-x-auto border-b border-line" aria-label="Sections">
      {items.map((t) => (
        <Link key={t.href + t.label} href={t.href} aria-current={t.active ? "page" : undefined}
          className={cn("inline-flex h-11 items-center gap-2 border-b-2 px-1 text-sm font-semibold", t.active ? "border-teal-700 text-ink" : "border-transparent text-muted hover:text-ink")}>
          {t.label}{t.count !== undefined && <Count>{t.count}</Count>}
        </Link>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ Brand */
export function Logo({ dark, size = 22, href = "/", external }: { dark?: boolean; size?: number; href?: string; external?: boolean }) {
  const inner = (
    <>
      <svg width={size + 6} height={size + 6} viewBox="0 0 28 28" aria-hidden="true">
        <rect x="1" y="1" width="26" height="26" rx="6" fill="#0B5F5C" />
        <path d="M8 19V9M13 19V9l7 10V9" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="21.5" cy="6.5" r="2.5" fill="#E07B22" />
      </svg>
      <span className={cn("font-display font-extrabold tracking-tight", dark ? "text-white" : "text-ink")} style={{ fontSize: size }}>IND2B</span>
    </>
  );
  const cls = "flex items-center gap-2.5";
  return external ? <a href={href} className={cls} aria-label="IND2B home">{inner}</a> : <Link href={href} className={cls} aria-label="IND2B home">{inner}</Link>;
}
