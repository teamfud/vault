"use client";

import { useCallback, useState, useTransition } from "react";
import { deleteCredential, revealCredential } from "../actions";
import { hashCredential } from "../../tools/actions";
import { CredentialForm, type CredentialRowData } from "./CredentialForm";
import { HistoryView } from "./HistoryView";
import { Badge, Button, Card, timeAgo, Th, theadClass } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { SecretCell } from "@/components/SecretCell";
import { ShadowHash } from "@/components/ShadowHash";
import { useNow } from "@/components/useNow";
import { useConfirm } from "@/components/useConfirm";

type Dialog =
  | { type: "add" }
  | { type: "edit" | "history" | "hash"; row: CredentialRowData }
  | null;

export function CredentialTable({ boxId, rows, isAdmin }: { boxId: string; rows: CredentialRowData[]; isAdmin: boolean }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [filter, setFilter] = useState<"ALL" | "USER" | "SERVICE">("ALL");
  const [pending, start] = useTransition();
  const close = useCallback(() => setDialog(null), []);
  const now = useNow();
  const [confirm, confirmDialog] = useConfirm();

  const shown = filter === "ALL" ? rows : rows.filter((r) => r.kind === filter);

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-md border-2 border-border bg-panel p-0.5 text-xs">
          {(["ALL", "USER", "SERVICE"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-2.5 py-0.5 font-display cursor-pointer ${filter === f ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}
            >
              {f === "ALL" ? "all" : f === "USER" ? "users" : "services"}
            </button>
          ))}
        </div>
        <Button onClick={() => setDialog({ type: "add" })}>+ add cred</Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className={theadClass}>
            <tr>
              <Th>account</Th>
              <Th>service</Th>
              <Th className="w-[34%]">password</Th>
              <Th>last change</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  no creds yet. suspicious…
                </td>
              </tr>
            )}
            {shown.map((row) => (
              <tr key={row.id} className="align-middle">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{row.username}</span>
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
                  <span className="text-fg">v{row.version}</span> · {row.updatedBy ?? "???"}
                  <br />
                  {now !== null && timeAgo(new Date(row.updatedAt), now)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setDialog({ type: "edit", row })}>
                      rotate / edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "history", row })}>
                      history
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "hash", row })}>
                      hash
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        className="hover:text-danger"
                        onClick={async () => {
                          const ok = await confirm({
                            title: "yeet cred",
                            message: `delete ${row.username}${row.service ? ` (${row.service})` : ""} and its whole password history? no take-backs.`,
                            confirmLabel: "yeet it",
                            danger: true,
                          });
                          if (ok) start(() => deleteCredential(row.id));
                        }}
                      >
                        yeet
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={dialog?.type === "add"} onClose={close} title="new cred">
        <CredentialForm boxId={boxId} onDone={close} />
      </Modal>
      <Modal open={dialog?.type === "edit"} onClose={close} title="rotate / edit cred">
        {dialog?.type === "edit" && <CredentialForm key={dialog.row.id} boxId={boxId} existing={dialog.row} onDone={close} />}
      </Modal>
      <Modal open={dialog?.type === "history"} onClose={close} title="password history" wide>
        {dialog?.type === "history" && <HistoryView credentialId={dialog.row.id} onDone={close} />}
      </Modal>
      <Modal open={dialog?.type === "hash"} onClose={close} title="yescrypt hash" wide>
        {dialog?.type === "hash" && (
          <div className="flex flex-col gap-4">
            <p className="text-muted">
              hashes the current password for <span className="font-semibold text-fg">{dialog.row.username}</span> so u can set
              it on the box without typing it there.
            </p>
            {dialog.row.kind === "SERVICE" && (
              <p className="rounded-md border-2 border-warn px-3 py-2 text-xs text-warn">
                heads up: this is a service cred. if it&apos;s a database or app login (not a linux account), don&apos;t
                usermod it, u&apos;d change the os user&apos;s password instead. so no commands here, just the hash.
              </p>
            )}
            <ShadowHash
              key={dialog.row.id}
              input={`${dialog.row.id}:${dialog.row.version}`}
              username={dialog.row.username}
              commands={dialog.row.kind === "USER"}
              getHash={(cost) => hashCredential(dialog.row.id, cost)}
            />
          </div>
        )}
      </Modal>
      {confirmDialog}
    </>
  );
}
