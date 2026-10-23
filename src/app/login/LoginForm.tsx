"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { Button, FormMessage, Input, Label } from "@/components/ui";
import { keepFields } from "@/components/useFormSubmit";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form onSubmit={keepFields(action)} className="flex flex-col gap-4">
      <Label>
        username
        <Input name="username" autoComplete="username" autoFocus required />
      </Label>
      <Label>
        password
        <Input name="password" type="password" autoComplete="current-password" required />
      </Label>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "checking vibes…" : "let me in →"}
      </Button>
    </form>
  );
}
