"use client";

import { useEffect, useState, useTransition } from "react";
import { getHistory, revealHistoryEntry, rollback, type HistoryRow } from "../actions";
import { Button, timeAgo } from "@/components/ui";
import { SecretCell } from "@/components/SecretCell";
import { useConfirm } from "@/components/useConfirm";

export function HistoryView({ credentialId, onDone }: { credentialId: string; onDone: () => void }) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [pending, start] = useTransition();
  const [confirm, confirmDialog] = useConfirm();

  useEffect(() => {
    getHistory(credentialId).then(setRows);
  }, [credentialId]);

  if (!rows) return <p className="text-muted">digging through the archives…</p>;
  if (rows.length === 0) return <p className="text-muted">no previous versions. fresh :)</p>;

  return (
    <>
      <ul className="flex flex-col divide-y divide-border/20">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>
                <span className="font-semibold text-fg">v{r.version}</span> · set by {r.changedBy ?? "???"} ·{" "}
                {timeAgo(new Date(r.changedAt))}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={async () => {
                  const ok = await confirm({
                    title: "restore password",
                    message: `bring back v${r.version} as the current password? the current one goes to history.`,
                    confirmLabel: "restore",
                  });
                  if (!ok) return;
                  start(async () => {
                    await rollback(r.id);
                    onDone();
                  });
                }}
              >
                restore
              </Button>
            </div>
            <SecretCell fetchSecret={() => revealHistoryEntry(r.id)} />
          </li>
        ))}
      </ul>
      {confirmDialog}
    </>
  );
}
