"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { Button, FormMessage, Input, Label } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Label>
        Username
        <Input name="username" autoComplete="username" autoFocus required />
      </Label>
      <Label>
        Password
        <Input name="password" type="password" autoComplete="current-password" required />
      </Label>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
