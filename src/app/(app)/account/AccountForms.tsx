"use client";

import { useActionState, useState, useTransition } from "react";
import { beginTotp, changePassword, confirmTotp, disableTotp } from "./actions";
import { Button, FormMessage, Input, Label } from "@/components/ui";
import type { FormState } from "@/lib/types";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Label>
        current password
        <Input name="current" type="password" autoComplete="current-password" required />
      </Label>
      <Label>
        new password (12+ chars)
        <Input name="next" type="password" autoComplete="new-password" required minLength={12} />
      </Label>
      <Label>
        new password again
        <Input name="confirm" type="password" autoComplete="new-password" required minLength={12} />
      </Label>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="self-start">
        change it
      </Button>
    </form>
  );
}

export function TotpSetup() {
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();

  if (!setup)
    return (
      <Button variant="secondary" disabled={pending} onClick={() => start(async () => setSetup(await beginTotp()))}>
        set up authenticator app
      </Button>
    );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted">scan this with ur authenticator app, then type the 6-digit code.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={setup.qr} alt="totp qr code" className="size-44 rounded border-2 border-border bg-white p-1 shadow-sticker [image-rendering:pixelated]" />
      <code className="break-all text-xs text-muted">{setup.secret}</code>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => setState(await confirmTotp(setup.secret, code)));
        }}
      >
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          placeholder="123456"
          className="w-32 font-mono"
        />
        <Button type="submit" disabled={pending}>
          verify &amp; enable
        </Button>
      </form>
      <FormMessage state={state} />
    </div>
  );
}

export function TotpDisable() {
  const [state, action, pending] = useActionState(disableTotp, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input name="code" inputMode="numeric" placeholder="current code" className="w-36 font-mono" required />
        <Button type="submit" variant="danger" disabled={pending}>
          turn off 2fa
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
