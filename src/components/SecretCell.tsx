"use client";

import { useEffect, useState, useTransition } from "react";
import { CopyButton } from "./CopyButton";

const HIDE_AFTER_MS = 30_000;

/** Masked secret with Reveal / Copy. Plaintext is fetched on demand and never cached. */
export function SecretCell({ fetchSecret }: { fetchSecret: (mode: "reveal" | "copy") => Promise<string> }) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (value === null) return;
    const t = setTimeout(() => setValue(null), HIDE_AFTER_MS);
    return () => clearTimeout(t);
  }, [value]);

  const reveal = () =>
    start(async () => {
      try {
        setError(false);
        setValue(await fetchSecret("reveal"));
      } catch {
        setError(true);
      }
    });

  return (
    <div className="flex min-w-0 items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded border border-dashed border-muted/60 bg-panel-2 px-2 py-1 font-mono text-xs select-all">
        {value ?? "••••••••••••"}
      </code>
      <button
        type="button"
        onClick={() => (value === null ? reveal() : setValue(null))}
        disabled={pending}
        className={`text-xs cursor-pointer ${error ? "text-danger" : "text-muted hover:text-fg"}`}
      >
        {value !== null ? "hide" : error ? "oops" : "peek"}
      </button>
      <CopyButton disabled={pending} getText={() => value ?? fetchSecret("copy")} />
    </div>
  );
}
