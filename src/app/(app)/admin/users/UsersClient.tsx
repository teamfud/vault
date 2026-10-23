"use client";

import { useActionState, useState, useTransition } from "react";
import { createUser, resetPassword, resetTotp, setDisabled, setRole } from "./actions";
import { Badge, Button, Card, FormMessage, Input, Label, Select, timeAgo, Th, theadClass } from "@/components/ui";
import { keepFields } from "@/components/useFormSubmit";

export type UserRow = {
  id: string;
  username: string;
  role: "ADMIN" | "MEMBER";
  disabled: boolean;
  totp: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
};

function TempPassword({ username, password }: { username?: string; password: string }) {
  return (
    <div className="rounded-md border-2 border-border bg-accent p-3 text-accent-fg shadow-sticker">
      <p className="mb-1">
        temp password{username ? ` for ${username}` : ""}. shown once, write it down! they&apos;ll have to change it.
      </p>
      <code className="select-all rounded bg-panel px-1.5 py-0.5 font-mono text-fg">{password}</code>
    </div>
  );
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUser, null);
  return (
    <form onSubmit={keepFields(action)} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Label className="flex-1">
          username
          <Input name="username" required autoComplete="off" />
        </Label>
        <Label>
          role
          <Select name="role" defaultValue="MEMBER">
            <option value="MEMBER">member</option>
            <option value="ADMIN">admin</option>
          </Select>
        </Label>
        <Button type="submit" disabled={pending}>
          + add to squad
        </Button>
      </div>
      {state?.error && <FormMessage state={state} />}
      {state?.tempPassword && <TempPassword password={state.tempPassword} />}
    </form>
  );
}

export function UsersTable({ users, selfId }: { users: UserRow[]; selfId: string }) {
  const [pending, start] = useTransition();
  const [temp, setTemp] = useState<{ username: string; password: string } | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {temp && <TempPassword username={temp.username} password={temp.password} />}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className={theadClass}>
            <tr>
              <Th>user</Th>
              <Th>role</Th>
              <Th>status</Th>
              <Th>last login</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {users.map((u) => {
              const self = u.id === selfId;
              return (
                <tr key={u.id} className={u.disabled ? "opacity-60" : ""}>
                  <td className="px-4 py-3 font-semibold">
                    {u.username} {self && <span className="text-xs text-muted">(u!)</span>}
                  </td>
                  <td className="px-4 py-3">
                    {self ? (
                      <Badge tone="accent">admin</Badge>
                    ) : (
                      <select
                        value={u.role}
                        disabled={pending}
                        onChange={(e) => start(() => setRole(u.id, e.target.value as UserRow["role"]))}
                        className="rounded border-2 border-border bg-panel px-1.5 py-0.5 text-xs"
                      >
                        <option value="MEMBER">member</option>
                        <option value="ADMIN">admin</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.disabled ? <Badge tone="danger">disabled</Badge> : <Badge tone="ok">active</Badge>}
                      {u.totp && <Badge tone="accent">2fa</Badge>}
                      {u.mustChangePassword && <Badge tone="warn">temp pw</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{u.lastLoginAt ? timeAgo(new Date(u.lastLoginAt)) : "never :("}</td>
                  <td className="px-4 py-3">
                    {!self && (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() =>
                            confirm(`reset ${u.username}'s password and kick them out?`) &&
                            start(async () => setTemp({ username: u.username, password: await resetPassword(u.id) }))
                          }
                        >
                          reset pw
                        </Button>
                        {u.totp && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => confirm(`remove 2fa for ${u.username}?`) && start(() => resetTotp(u.id))}
                          >
                            reset 2fa
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={u.disabled ? "secondary" : "danger"}
                          disabled={pending}
                          onClick={() => start(() => setDisabled(u.id, !u.disabled))}
                        >
                          {u.disabled ? "unban" : "ban"}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
