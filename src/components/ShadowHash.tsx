"use client";

import { useState, useTransition } from "react";
import type { HashResult } from "@/app/(app)/tools/actions";
import { Button, Select } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";

const COSTS = [
  { value: 5, label: "cost 5 (default, 16 mib)" },
  { value: 3, label: "cost 3 (4 mib)" },
  { value: 4, label: "cost 4 (8 mib)" },
  { value: 6, label: "cost 6 (32 mib)" },
  { value: 7, label: "cost 7 (64 mib)" },
  { value: 1, label: "cost 1 (1 mib, potato boxes)" },
  { value: 2, label: "cost 2 (2 mib)" },
];

// Close to shadow-utils' default NAME_REGEX (plus uppercase, which some distros allow).
const LINUX_USERNAME = /^[A-Za-z_][A-Za-z0-9_.-]{0,31}\$?$/;

/** Single-quote for POSIX shells. */
const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

function CopyLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded border border-dashed border-muted/60 bg-panel-2 px-2 py-1.5 font-mono text-xs select-all">
          {value}
        </code>
        <CopyButton getText={() => value} />
      </div>
    </div>
  );
}

/**
 * Cost picker + "hash it" button + the resulting `$y$` hash and, when
 * `commands` is on, ready-to-paste usermod/chpasswd lines.
 *
 * `input` identifies what's being hashed (the password, or a credential id +
 * version). A result is only shown while both it and the cost still match
 * what was hashed, so a stale hash can never sit next to new input.
 */
export function ShadowHash({
  input,
  username,
  getHash,
  disabled,
  commands = true,
}: {
  input: string;
  username?: string;
  getHash: (cost: number) => Promise<HashResult>;
  disabled?: boolean;
  commands?: boolean;
}) {
  const [cost, setCost] = useState(5);
  const [result, setResult] = useState<(HashResult & { input: string; cost: number }) | null>(null);
  const [pending, start] = useTransition();

  const shown = result && result.input === input && result.cost === cost ? result : null;
  const user = username?.trim() || "USERNAME";
  const validUser = LINUX_USERNAME.test(user);

  const run = () => {
    const at = { input, cost };
    start(async () => {
      try {
        setResult({ ...(await getHash(at.cost)), ...at });
      } catch {
        setResult({ error: "something broke. refresh and try again?", ...at });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={cost} onChange={(e) => setCost(Number(e.target.value))} className="w-72" aria-label="yescrypt cost">
          {COSTS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <Button type="button" disabled={disabled || pending} onClick={run}>
          {pending ? "crunching…" : "hash it"}
        </Button>
      </div>
      {shown?.error && <p className="text-xs text-danger">✗ {shown.error}</p>}
      {shown?.hash && (
        <div className="flex flex-col gap-3">
          <CopyLine label="yescrypt hash (for /etc/shadow)" value={shown.hash} />
          {commands && validUser && (
            <>
              <CopyLine label="set it with usermod" value={`usermod -p ${sq(shown.hash)} ${sq(user)}`} />
              <CopyLine label="or with chpasswd" value={`echo ${sq(`${user}:${shown.hash}`)} | chpasswd -e`} />
            </>
          )}
          {commands && !validUser && (
            <p className="text-xs text-warn">
              “{user}” can&apos;t be a linux account name, so no usermod/chpasswd commands. the hash above still works if u
              know what ur doing.
            </p>
          )}
          <p className="text-[11px] text-muted">new salt every time, so the hash changes on each click. that&apos;s normal :)</p>
        </div>
      )}
    </div>
  );
}
