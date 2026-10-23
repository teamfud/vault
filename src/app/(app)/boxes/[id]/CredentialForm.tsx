"use client";

import { useActionState, useEffect, useState } from "react";
import { addCredential, updateCredential } from "../actions";
import { Button, FormMessage, Input, Label, Select, Textarea } from "@/components/ui";
import { Generator } from "@/components/Generator";
import { keepFields } from "@/components/useFormSubmit";

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
    <form onSubmit={keepFields(action)} className="flex flex-col gap-4">
      {existing ? <input type="hidden" name="id" value={existing.id} /> : <input type="hidden" name="boxId" value={boxId} />}
      <div className="grid grid-cols-2 gap-3">
        <Label>
          type
          <Select name="kind" defaultValue={existing?.kind ?? "USER"}>
            <option value="USER">user account</option>
            <option value="SERVICE">service account</option>
          </Select>
        </Label>
        <Label>
          service
          <Input name="service" defaultValue={existing?.service} placeholder="ssh, mysql, ad, web…" />
        </Label>
      </div>
      <Label>
        username
        <Input name="username" defaultValue={existing?.username} required autoComplete="off" />
      </Label>
      <Label>
        {existing ? "new password (leave blank to keep it)" : "password"}
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
            {show ? "hide" : "peek"}
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
        notes
        <Textarea name="notes" defaultValue={existing?.notes ?? ""} placeholder="where it's used, lore, etc…" />
      </Label>
      <FormMessage state={state} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          nvm
        </Button>
        <Button type="submit" disabled={pending}>
          {existing ? "save it" : "add it"}
        </Button>
      </div>
    </form>
  );
}
