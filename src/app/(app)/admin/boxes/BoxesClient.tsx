"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { deleteBox, saveBox } from "./actions";
import { Button, Card, FormMessage, Input, Label, Textarea } from "@/components/ui";
import { Modal } from "@/components/Modal";

export type BoxRow = { id: string; name: string; address: string | null; os: string | null; notes: string | null; count: number };

function BoxForm({ box, onDone }: { box?: BoxRow; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveBox, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="flex flex-col gap-3">
      {box && <input type="hidden" name="id" value={box.id} />}
      <Label>
        Name
        <Input name="name" defaultValue={box?.name} required placeholder="web01" />
      </Label>
      <div className="grid grid-cols-2 gap-3">
        <Label>
          Hostname / IP
          <Input name="address" defaultValue={box?.address ?? ""} placeholder="10.0.1.10" />
        </Label>
        <Label>
          OS
          <Input name="os" defaultValue={box?.os ?? ""} placeholder="Ubuntu 22.04" />
        </Label>
      </div>
      <Label>
        Notes
        <Textarea name="notes" defaultValue={box?.notes ?? ""} placeholder="Scored services, owner, quirks…" />
      </Label>
      <FormMessage state={state} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {box ? "Save" : "Add box"}
        </Button>
      </div>
    </form>
  );
}

export function BoxesClient({ boxes }: { boxes: BoxRow[] }) {
  const [editing, setEditing] = useState<BoxRow | "new" | null>(null);
  const [pending, start] = useTransition();
  const close = useCallback(() => setEditing(null), []);

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setEditing("new")}>+ Add box</Button>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Address</th>
              <th className="px-4 py-2.5 font-medium">OS</th>
              <th className="px-4 py-2.5 font-medium">Credentials</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {boxes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  No boxes yet.
                </td>
              </tr>
            )}
            {boxes.map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/boxes/${b.id}`} className="hover:text-accent">
                    {b.name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{b.address || "—"}</td>
                <td className="px-4 py-3 text-muted">{b.os || "—"}</td>
                <td className="px-4 py-3">{b.count}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(b)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="hover:text-danger"
                      disabled={pending}
                      onClick={() =>
                        confirm(`Delete ${b.name} and all ${b.count} of its credentials? This can't be undone.`) &&
                        start(() => deleteBox(b.id))
                      }
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Modal open={editing !== null} onClose={close} title={editing === "new" ? "Add box" : "Edit box"}>
        {editing && <BoxForm key={editing === "new" ? "new" : editing.id} box={editing === "new" ? undefined : editing} onDone={close} />}
      </Modal>
    </>
  );
}
