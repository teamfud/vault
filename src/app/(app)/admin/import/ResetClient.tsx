"use client";

import { startTransition, useActionState, useState } from "react";
import { resetVault } from "./resetAction";
import { Button, FormMessage, Input } from "@/components/ui";
import { useConfirm } from "@/components/useConfirm";
import { RESET_PHRASE } from "@/lib/types";

export function ResetClient() {
  const [state, action, pending] = useActionState(resetVault, null);
  const [typed, setTyped] = useState("");
  const [confirm, dialog] = useConfirm();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const ok = await confirm({
          title: "reset the vault?",
          message: "every box, cred, cred history, artifact and audit entry gets deleted. users stay. no undo.",
          confirmLabel: "wipe it",
          danger: true,
        });
        if (!ok) return;
        startTransition(() => action(form));
        setTyped("");
      }}
    >
      <Input
        name="confirm"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={RESET_PHRASE}
        autoComplete="off"
        spellCheck={false}
      />
      <Button variant="danger" disabled={pending || typed.trim().toLowerCase() !== RESET_PHRASE}>
        {pending ? "wiping…" : "reset everything"}
      </Button>
      <FormMessage state={state} />
      {dialog}
    </form>
  );
}
