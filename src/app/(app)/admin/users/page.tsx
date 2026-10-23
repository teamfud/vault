import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { CreateUserForm, UsersTable } from "./UsersClient";

export default async function UsersPage() {
  const admin = await requireAdmin();
  const users = await db.user.findMany({ orderBy: [{ role: "asc" }, { username: "asc" }] });
  return (
    <>
      <PageHeader title="users" sub="the squad" />
      <Card className="mb-5 p-5">
        <CreateUserForm />
      </Card>
      <UsersTable
        selfId={admin.id}
        users={users.map((u) => ({
          id: u.id,
          username: u.username,
          role: u.role,
          disabled: u.disabled,
          totp: !!u.totpSecret,
          mustChangePassword: u.mustChangePassword,
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        }))}
      />
    </>
  );
}
