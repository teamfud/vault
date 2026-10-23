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
        Current password
        <Input name="current" type="password" autoComplete="current-password" required />
      </Label>
      <Label>
        New password
        <Input name="next" type="password" autoComplete="new-password" required minLength={12} />
      </Label>
      <Label>
        Confirm new password
        <Input name="confirm" type="password" autoComplete="new-password" required minLength={12} />
      </Label>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="self-start">
        Change password
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
        Set up authenticator app
      </Button>
    );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Scan this with your authenticator app, then enter the 6-digit code.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={setup.qr} alt="TOTP QR code" className="size-44 rounded bg-white p-1" />
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
          Verify &amp; enable
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
        <Input name="code" inputMode="numeric" placeholder="Current code" className="w-36 font-mono" required />
        <Button type="submit" variant="danger" disabled={pending}>
          Disable 2FA
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
