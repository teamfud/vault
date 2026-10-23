import { requireUser } from "@/lib/auth";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ChangePasswordForm, TotpDisable, TotpSetup } from "./AccountForms";

export default async function AccountPage() {
  const user = await requireUser({ allowPasswordChange: true });
  return (
    <>
      <PageHeader title="ur account" sub={`hi ${user.username} :)`} />
      {user.mustChangePassword && (
        <div className="mb-5 rounded-md border-2 border-border bg-accent px-4 py-3 text-accent-fg shadow-sticker">
          first things first: set a new password before u touch anything.
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg">password</h2>
          <ChangePasswordForm />
        </Card>
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="font-display text-lg">2fa</h2>
            {user.totpEnabled ? <Badge tone="ok">on</Badge> : <Badge>off</Badge>}
          </div>
          {user.totpEnabled ? <TotpDisable /> : <TotpSetup />}
        </Card>
      </div>
    </>
  );
}
