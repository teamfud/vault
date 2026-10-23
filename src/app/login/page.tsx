import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthShell } from "./AuthShell";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session?.verified) redirect("/");
  return (
    <AuthShell title="Sign in">
      <LoginForm />
    </AuthShell>
  );
}
