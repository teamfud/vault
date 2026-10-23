"use client";

import { useActionState, useEffect, useState } from "react";
import { addCredential, updateCredential } from "../actions";
import { Button, FormMessage, Input, Label, Select, Textarea } from "@/components/ui";
import { Generator } from "@/components/Generator";

export type CredentialRowData = {
  id: string;
  kind: "USER" | "SERVICE";
  service: string;
  username: string;
  notes: string | null;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
};

export function CredentialForm({
  boxId,
  existing,
  onDone,
}: {
  boxId: string;
  existing?: CredentialRowData;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(existing ? updateCredential : addCredential, null);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {existing ? <input type="hidden" name="id" value={existing.id} /> : <input type="hidden" name="boxId" value={boxId} />}
      <div className="grid grid-cols-2 gap-3">
        <Label>
          Type
          <Select name="kind" defaultValue={existing?.kind ?? "USER"}>
            <option value="USER">User account</option>
            <option value="SERVICE">Service account</option>
          </Select>
        </Label>
        <Label>
          Service
          <Input name="service" defaultValue={existing?.service} placeholder="ssh, mysql, AD, web…" />
        </Label>
      </div>
      <Label>
        Username
        <Input name="username" defaultValue={existing?.username} required autoComplete="off" />
      </Label>
      <Label>
        {existing ? "New password (leave blank to keep current)" : "Password"}
        <div className="flex gap-2">
          <Input
            name="password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!existing}
            autoComplete="new-password"
            className="font-mono"
          />
          <Button type="button" variant="secondary" onClick={() => setShow((s) => !s)}>
            {show ? "Hide" : "Show"}
          </Button>
        </div>
      </Label>
      <Generator
        onGenerate={(v) => {
          setPassword(v);
          setShow(true);
        }}
      />
      <Label>
        Notes
        <Textarea name="notes" defaultValue={existing?.notes ?? ""} placeholder="Where it's used, who rotated it last…" />
      </Label>
      <FormMessage state={state} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {existing ? "Save" : "Add credential"}
        </Button>
      </div>
    </form>
  );
}
