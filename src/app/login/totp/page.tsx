import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthShell } from "../AuthShell";
import { TotpForm } from "./TotpForm";

export default async function TotpPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.verified) redirect("/");
  return (
    <AuthShell title="prove it (2fa)">
      <TotpForm />
    </AuthShell>
  );
}
