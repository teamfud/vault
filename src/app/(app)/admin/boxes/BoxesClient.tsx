"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { deleteBox, saveBox } from "./actions";
import { Button, Card, FormMessage, Input, Label, Textarea, Th, theadClass } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { keepFields } from "@/components/useFormSubmit";

export type BoxRow = { id: string; name: string; address: string | null; os: string | null; notes: string | null; count: number };

function BoxForm({ box, onDone }: { box?: BoxRow; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveBox, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form onSubmit={keepFields(action)} className="flex flex-col gap-3">
      {box && <input type="hidden" name="id" value={box.id} />}
      <Label>
        name
        <Input name="name" defaultValue={box?.name} required placeholder="web01" />
      </Label>
      <div className="grid grid-cols-2 gap-3">
        <Label>
          hostname / ip
          <Input name="address" defaultValue={box?.address ?? ""} placeholder="10.0.1.10" />
        </Label>
        <Label>
          os
          <Input name="os" defaultValue={box?.os ?? ""} placeholder="ubuntu 22.04" />
        </Label>
      </div>
      <Label>
        notes
        <Textarea name="notes" defaultValue={box?.notes ?? ""} placeholder="scored services, quirks, lore…" />
      </Label>
      <FormMessage state={state} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          nvm
        </Button>
        <Button type="submit" disabled={pending}>
          {box ? "save it" : "add it"}
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
        <Button onClick={() => setEditing("new")}>+ add box</Button>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className={theadClass}>
            <tr>
              <Th>name</Th>
              <Th>address</Th>
              <Th>os</Th>
              <Th>creds</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {boxes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  no boxes yet. add one!
                </td>
              </tr>
            )}
            {boxes.map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-3 font-display text-base">
                  <Link href={`/boxes/${b.id}`} className="hover:underline decoration-accent decoration-2">
                    {b.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-muted">{b.address || "—"}</td>
                <td className="px-4 py-3 text-muted">{b.os || "—"}</td>
                <td className="px-4 py-3">{b.count}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(b)}>
                      edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="hover:text-danger"
                      disabled={pending}
                      onClick={() =>
                        confirm(`yeet ${b.name} and all ${b.count} of its creds? this can't be undone!!`) &&
                        start(() => deleteBox(b.id))
                      }
                    >
                      yeet
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Modal open={editing !== null} onClose={close} title={editing === "new" ? "new box" : "edit box"}>
        {editing && <BoxForm key={editing === "new" ? "new" : editing.id} box={editing === "new" ? undefined : editing} onDone={close} />}
      </Modal>
    </>
  );
}
