"use client";

import { useCallback, useState, useTransition } from "react";
import { deleteCredential, revealCredential } from "../actions";
import { CredentialForm, type CredentialRowData } from "./CredentialForm";
import { HistoryView } from "./HistoryView";
import { Badge, Button, Card, timeAgo } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { SecretCell } from "@/components/SecretCell";

type Dialog = { type: "add" } | { type: "edit"; row: CredentialRowData } | { type: "history"; row: CredentialRowData } | null;

export function CredentialTable({ boxId, rows, isAdmin }: { boxId: string; rows: CredentialRowData[]; isAdmin: boolean }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [filter, setFilter] = useState<"ALL" | "USER" | "SERVICE">("ALL");
  const [pending, start] = useTransition();
  const close = useCallback(() => setDialog(null), []);

  const shown = filter === "ALL" ? rows : rows.filter((r) => r.kind === filter);

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-md bg-panel-2 p-0.5 text-xs">
          {(["ALL", "USER", "SERVICE"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-2.5 py-1 cursor-pointer ${filter === f ? "bg-panel text-fg shadow-sm" : "text-muted"}`}
            >
              {f === "ALL" ? "All" : f === "USER" ? "Users" : "Services"}
            </button>
          ))}
        </div>
        <Button onClick={() => setDialog({ type: "add" })}>+ Add credential</Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Account</th>
              <th className="px-4 py-2.5 font-medium">Service</th>
              <th className="w-[34%] px-4 py-2.5 font-medium">Password</th>
              <th className="px-4 py-2.5 font-medium">Last change</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  No credentials yet.
                </td>
              </tr>
            )}
            {shown.map((row) => (
              <tr key={row.id} className="align-middle">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{row.username}</span>
                    <Badge tone={row.kind === "SERVICE" ? "warn" : "neutral"}>{row.kind === "SERVICE" ? "svc" : "user"}</Badge>
                  </div>
                  {row.notes && <p className="mt-0.5 max-w-xs truncate text-xs text-muted" title={row.notes}>{row.notes}</p>}
                </td>
                <td className="px-4 py-3 text-muted">{row.service || "—"}</td>
                <td className="px-4 py-3">
                  {/* key on version so a rotation drops any revealed old value */}
                  <SecretCell key={row.version} fetchSecret={(mode) => revealCredential(row.id, mode)} />
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  <span className="text-fg">v{row.version}</span> · {row.updatedBy ?? "—"}
                  <br />
                  {timeAgo(new Date(row.updatedAt))}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setDialog({ type: "edit", row })}>
                      Rotate / edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "history", row })}>
                      History
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        className="hover:text-danger"
                        onClick={() => {
                          if (confirm(`Delete ${row.username}${row.service ? ` (${row.service})` : ""} and its history?`))
                            start(() => deleteCredential(row.id));
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={dialog?.type === "add"} onClose={close} title="Add credential">
        <CredentialForm boxId={boxId} onDone={close} />
      </Modal>
      <Modal open={dialog?.type === "edit"} onClose={close} title="Rotate / edit credential">
        {dialog?.type === "edit" && <CredentialForm key={dialog.row.id} boxId={boxId} existing={dialog.row} onDone={close} />}
      </Modal>
      <Modal open={dialog?.type === "history"} onClose={close} title="Password history" wide>
        {dialog?.type === "history" && <HistoryView credentialId={dialog.row.id} onDone={close} />}
      </Modal>
    </>
  );
}
