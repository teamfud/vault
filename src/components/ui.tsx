import type { ComponentProps } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const buttonVariants = {
  primary: "bg-accent text-accent-fg hover:opacity-90",
  secondary: "bg-panel-2 text-fg border border-border hover:border-accent",
  ghost: "text-muted hover:text-fg hover:bg-panel-2",
  danger: "bg-transparent text-danger border border-danger/50 hover:bg-danger/10",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof buttonVariants; size?: "sm" | "md" }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
        buttonVariants[variant],
        className,
      )}
    />
  );
}

export const inputClass =
  "h-9 w-full rounded-md border border-border bg-panel px-3 text-sm text-fg placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cx(inputClass, className)} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} className={cx(inputClass, "pr-8", className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx(inputClass, "h-auto min-h-20 py-2", className)} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label {...props} className={cx("flex flex-col gap-1.5 text-xs font-medium text-muted", className)} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cx("rounded-lg border border-border bg-panel", className)} />;
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: "neutral" | "accent" | "danger" | "ok" | "warn" }) {
  const tones = {
    neutral: "bg-panel-2 text-muted",
    accent: "bg-accent/15 text-accent",
    danger: "bg-danger/15 text-danger",
    ok: "bg-ok/15 text-ok",
    warn: "bg-warn/15 text-warn",
  };
  return (
    <span
      {...props}
      className={cx("inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide", tones[tone], className)}
    />
  );
}

export function FormMessage({ state }: { state?: { error?: string; ok?: string } | null }) {
  if (!state) return null;
  if (state.error) return <p className="text-sm text-danger">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-ok">{state.ok}</p>;
  return null;
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function timeAgo(d: Date) {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export { cx };
