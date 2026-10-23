"use client";

import { useActionState, useState, useTransition } from "react";
import { createUser, resetPassword, resetTotp, setDisabled, setRole } from "./actions";
import { Badge, Button, Card, FormMessage, Input, Label, Select, timeAgo } from "@/components/ui";

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
    <div className="rounded-md border border-ok/40 bg-ok/10 p-3 text-sm">
      <p className="mb-1 text-ok">
        Temporary password{username ? ` for ${username}` : ""} — shown once. They&apos;ll be asked to change it.
      </p>
      <code className="select-all font-mono text-fg">{password}</code>
    </div>
  );
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUser, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Label className="flex-1">
          Username
          <Input name="username" required autoComplete="off" />
        </Label>
        <Label>
          Role
          <Select name="role" defaultValue="MEMBER">
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </Label>
        <Button type="submit" disabled={pending}>
          Create user
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
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Last login</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => {
              const self = u.id === selfId;
              return (
                <tr key={u.id} className={u.disabled ? "opacity-60" : ""}>
                  <td className="px-4 py-3 font-mono font-medium">
                    {u.username} {self && <span className="font-sans text-xs text-muted">(you)</span>}
                  </td>
                  <td className="px-4 py-3">
                    {self ? (
                      <Badge tone="accent">admin</Badge>
                    ) : (
                      <select
                        value={u.role}
                        disabled={pending}
                        onChange={(e) => start(() => setRole(u.id, e.target.value as UserRow["role"]))}
                        className="rounded border border-border bg-panel px-1.5 py-1 text-xs"
                      >
                        <option value="MEMBER">Member</option>
                        <option value="ADMIN">Admin</option>
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
                  <td className="px-4 py-3 text-xs text-muted">{u.lastLoginAt ? timeAgo(new Date(u.lastLoginAt)) : "never"}</td>
                  <td className="px-4 py-3">
                    {!self && (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() =>
                            confirm(`Reset ${u.username}'s password and sign them out?`) &&
                            start(async () => setTemp({ username: u.username, password: await resetPassword(u.id) }))
                          }
                        >
                          Reset password
                        </Button>
                        {u.totp && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => confirm(`Remove 2FA for ${u.username}?`) && start(() => resetTotp(u.id))}
                          >
                            Reset 2FA
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={u.disabled ? "secondary" : "danger"}
                          disabled={pending}
                          onClick={() => start(() => setDisabled(u.id, !u.disabled))}
                        >
                          {u.disabled ? "Enable" : "Disable"}
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
