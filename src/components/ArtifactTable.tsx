"use client";

import { useActionState, useCallback, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { deleteArtifact, setArtifactPublic, unpublishArtifact, updateArtifact } from "@/app/(app)/artifacts/actions";
import type { ArtifactRow } from "@/lib/artifacts";
import { EXPIRY_OPTIONS, type Expiry } from "@/lib/expiry";
import { formatBytes } from "@/lib/filename";
import type { FormState } from "@/lib/types";
import { Badge, Button, Card, FormMessage, Label, Select, Textarea, timeAgo, Th, theadClass } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { Modal } from "@/components/Modal";
import { keepFields } from "@/components/useFormSubmit";
import { useNow } from "@/components/useNow";
import { useConfirm } from "@/components/useConfirm";

type Dialog = { type: "publish" | "edit"; row: ArtifactRow } | null;

const noSubscribe = () => () => {};
const useOrigin = () => useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");

function timeLeft(iso: string, now: number) {
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  if (s <= 0) return null;
  if (s < 3600) return `${Math.ceil(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export function ArtifactTable({
  rows,
  boxes,
  showBox = true,
}: {
  rows: ArtifactRow[];
  boxes: { id: string; name: string }[];
  showBox?: boolean;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, start] = useTransition();
  const close = useCallback(() => setDialog(null), []);
  const origin = useOrigin();
  const now = useNow();
  const [confirm, confirmDialog] = useConfirm();

  return (
    <>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead className={theadClass}>
            <tr>
              <Th>file</Th>
              {showBox && <Th>box</Th>}
              <Th>uploaded</Th>
              <Th className="w-[38%]">public link</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {rows.length === 0 && (
              <tr>
                <td colSpan={showBox ? 5 : 4} className="px-4 py-10 text-center text-muted">
                  no artifacts yet. upload some tools :)
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const url = row.publicPath && origin + row.publicPath;
              // Until `now` is known (server render, hydration) show no countdown.
              const left = row.publicExpiresAt && now !== null ? timeLeft(row.publicExpiresAt, now) : null;
              const expired = !!row.publicExpiresAt && now !== null && !left;
              return (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-3">
                    <a href={`/api/artifacts/${row.id}`} className="font-semibold underline decoration-accent decoration-2 underline-offset-2" title="download">
                      {row.name}
                    </a>
                    <div className="mt-0.5 flex items-center gap-2 whitespace-nowrap text-xs text-muted">
                      {formatBytes(row.size)} ·
                      <span className="font-mono" title={`sha256 ${row.sha256}`}>
                        {row.sha256.slice(0, 12)}
                      </span>
                      <CopyButton getText={() => row.sha256} />
                    </div>
                    {row.notes && <p className="mt-0.5 max-w-xs whitespace-pre-wrap text-xs text-muted">{row.notes}</p>}
                  </td>
                  {showBox && (
                    <td className="px-4 py-3">
                      {row.boxId ? (
                        <a href={`/boxes/${row.boxId}`} className="hover:underline">{row.boxName}</a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                    {row.uploadedBy ?? "???"}
                    <br />
                    {now !== null && timeAgo(new Date(row.createdAt), now)}
                  </td>
                  <td className="px-4 py-3">
                    {url ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          {/* table auto-layout ignores truncate without a hard max width */}
                          <code className={`block max-w-[22rem] truncate rounded border border-border/40 bg-panel-2 px-1.5 py-0.5 text-[11px] ${expired ? "text-muted line-through" : ""}`} title={url}>
                            {url}
                          </code>
                          <CopyButton getText={() => url} disabled={expired} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          {expired ? (
                            <Badge tone="danger">expired</Badge>
                          ) : (
                            <Badge tone="warn">{left ? `public · ${left} left` : row.publicExpiresAt ? "public" : "public · no expiry"}</Badge>
                          )}
                          <span>
                            {row.publicHits} hit{row.publicHits === 1 ? "" : "s"}
                          </span>
                          {!expired && (
                            <span className="flex items-center gap-1">
                              curl
                              <CopyButton getText={() => `curl -fsSLo ${shellQuote(row.name)} ${shellQuote(url)}`} />
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <Badge>private</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1 whitespace-nowrap">
                      {row.publicPath ? (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => setDialog({ type: "publish", row })}>
                            expiry
                          </Button>
                          <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => unpublishArtifact(row.id))}>
                            unpublish
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => setDialog({ type: "publish", row })}>
                          make public
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "edit", row })}>
                        edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        className="hover:text-danger"
                        onClick={async () => {
                          const ok = await confirm({
                            title: "yeet artifact",
                            message: (
                              <>
                                delete <span className="font-semibold text-fg">{row.name}</span>
                                {row.boxName && ` from ${row.boxName}`}?{row.publicPath && " its public url stops working."} no
                                take-backs.
                              </>
                            ),
                            confirmLabel: "yeet it",
                            danger: true,
                          });
                          if (ok) start(() => deleteArtifact(row.id));
                        }}
                      >
                        yeet
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Modal open={dialog?.type === "publish"} onClose={close} title={dialog?.row.publicPath ? "change expiry" : "make public"}>
        {dialog?.type === "publish" && <PublishForm key={dialog.row.id} row={dialog.row} onDone={close} />}
      </Modal>
      <Modal open={dialog?.type === "edit"} onClose={close} title="edit artifact">
        {dialog?.type === "edit" && <EditForm key={dialog.row.id} row={dialog.row} boxes={boxes} onDone={close} />}
      </Modal>
      {confirmDialog}
    </>
  );
}

function PublishForm({ row, onDone }: { row: ArtifactRow; onDone: () => void }) {
  const [expiry, setExpiry] = useState<Expiry>("24h");
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      {row.boxId ? (
        <p className="text-muted">
          anyone with <span className="text-fg">{row.boxName}</span>&apos;s box link can download{" "}
          <span className="font-semibold text-fg">{row.name}</span>, no login. it&apos;s not listed anywhere, but treat the
          url like a password.
        </p>
      ) : (
        <p className="text-muted">
          <span className="font-semibold text-fg">{row.name}</span> gets its own secret url, downloadable with no login.
          it&apos;s not listed anywhere, but treat it like a password.
        </p>
      )}
      <Label>
        expires after
        <Select value={expiry} onChange={(e) => setExpiry(e.target.value as Expiry)}>
          {Object.keys(EXPIRY_OPTIONS).map((k) => (
            <option key={k} value={k}>
              {k === "never" ? "never (until unpublished)" : k}
            </option>
          ))}
        </Select>
      </Label>
      <FormMessage state={state?.error ? state : null} />
      <Button
        disabled={pending}
        className="self-start"
        onClick={() =>
          start(async () => {
            const result = await setArtifactPublic(row.id, expiry);
            if (result?.error) setState(result);
            else onDone();
          })
        }
      >
        {row.publicPath ? "save" : "make public"}
      </Button>
    </div>
  );
}

function EditForm({ row, boxes, onDone }: { row: ArtifactRow; boxes: { id: string; name: string }[]; onDone: () => void }) {
  const [state, action, pending] = useActionState(updateArtifact, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form onSubmit={keepFields(action)} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={row.id} />
      <Label>
        box
        <Select name="boxId" defaultValue={row.boxId ?? ""}>
          <option value="">— no box —</option>
          {boxes.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </Label>
      <Label>
        notes
        <Textarea name="notes" defaultValue={row.notes ?? ""} />
      </Label>
      <FormMessage state={state} />
      <Button disabled={pending} className="self-start">
        save
      </Button>
    </form>
  );
}
