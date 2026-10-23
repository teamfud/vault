import { requireUser } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { HashTool } from "./HashTool";

export default async function HashToolPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="hash tool" sub="turn a password into a yescrypt hash for /etc/shadow" />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="p-5">
          <HashTool />
        </Card>
        <Card className="h-fit p-5 text-muted">
          <h2 className="mb-2 font-display text-lg text-fg">wut</h2>
          <p className="mb-2">
            yescrypt (<code className="text-fg">$y$…</code>) is the default password hash on modern debian, ubuntu, fedora
            and arch. paste the hash into <code className="text-fg">usermod -p</code> or{" "}
            <code className="text-fg">chpasswd -e</code> to set a password without typing it on the box.
          </p>
          <p>
            older boxes (rhel 8, ubuntu 20.04 and earlier) might not know yescrypt. check{" "}
            <code className="text-fg">grep yescrypt /etc/login.defs</code> or just try logging in after.
          </p>
        </Card>
      </div>
    </>
  );
}
