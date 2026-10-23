"use client";

import { useActionState } from "react";
import { logout, verifyTotp } from "../actions";
import { Button, FormMessage, Input, Label } from "@/components/ui";

export function TotpForm() {
  const [state, action, pending] = useActionState(verifyTotp, null);
  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-4">
        <Label>
          6-digit code from ur authenticator app
          <Input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            autoFocus
            required
            className="font-mono tracking-[0.3em]"
          />
        </Label>
        <FormMessage state={state} />
        <Button type="submit" disabled={pending}>
          verify
        </Button>
      </form>
      <form action={logout}>
        <Button type="submit" variant="ghost" className="w-full">
          nvm, go back
        </Button>
      </form>
    </div>
  );
}
