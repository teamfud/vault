"use client";

import { useEffect, useState, useTransition } from "react";

const HIDE_AFTER_MS = 30_000;

/** Masked secret with Reveal / Copy. Plaintext is fetched on demand and never cached. */
export function SecretCell({ fetchSecret }: { fetchSecret: (mode: "reveal" | "copy") => Promise<string> }) {
  const [value, setValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (value === null) return;
    const t = setTimeout(() => setValue(null), HIDE_AFTER_MS);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const run = (mode: "reveal" | "copy") =>
    start(async () => {
      try {
        setError(false);
        const secret = value ?? (await fetchSecret(mode));
        if (mode === "reveal") setValue(secret);
        else {
          await navigator.clipboard.writeText(secret);
          setCopied(true);
        }
      } catch {
        setError(true);
      }
    });

  return (
    <div className="flex min-w-0 items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded bg-panel-2 px-2 py-1 font-mono text-xs select-all">
        {value ?? "••••••••••••"}
      </code>
      <button
        type="button"
        onClick={() => (value === null ? run("reveal") : setValue(null))}
        disabled={pending}
        className="text-xs text-muted hover:text-fg cursor-pointer"
      >
        {value === null ? "Reveal" : "Hide"}
      </button>
      <button
        type="button"
        onClick={() => run("copy")}
        disabled={pending}
        className={`w-12 text-xs cursor-pointer ${copied ? "text-ok" : error ? "text-danger" : "text-accent hover:underline"}`}
      >
        {copied ? "Copied" : error ? "Error" : "Copy"}
      </button>
    </div>
  );
}
