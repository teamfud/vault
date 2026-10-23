import { requireUser } from "@/lib/auth";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ChangePasswordForm, TotpDisable, TotpSetup } from "./AccountForms";

export default async function AccountPage() {
  const user = await requireUser({ allowPasswordChange: true });
  return (
    <>
      <PageHeader title="Account" />
      {user.mustChangePassword && (
        <div className="mb-5 rounded-md border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          You must set a new password before using the vault.
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Password</h2>
          <ChangePasswordForm />
        </Card>
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="font-semibold">Two-factor authentication</h2>
            {user.totpEnabled ? <Badge tone="ok">on</Badge> : <Badge>off</Badge>}
          </div>
          {user.totpEnabled ? <TotpDisable /> : <TotpSetup />}
        </Card>
      </div>
    </>
  );
}
