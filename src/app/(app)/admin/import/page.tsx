import { requireAdmin } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { ImportClient } from "./ImportClient";

export default async function ImportPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Import / Export" />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="p-5">
          <h2 className="mb-1 font-semibold">Import CSV</h2>
          <p className="mb-4 text-sm text-muted">
            Columns: <code className="text-fg">box, address, os, kind, service, username, password, notes</code>. Only box,
            username and password are required. Rows matching an existing box + service + username rotate that credential
            (the old value goes to history). Boxes are created as needed.
          </p>
          <ImportClient />
        </Card>
        <Card className="h-fit p-5">
          <h2 className="mb-1 font-semibold">Export</h2>
          <p className="mb-4 text-sm text-muted">
            Downloads every credential <strong className="text-warn">in plaintext</strong>. The export is logged. Store the file
            securely and delete it when done.
          </p>
          <a
            href="/api/export"
            className="inline-flex h-9 items-center rounded-md border border-border bg-panel-2 px-3.5 text-sm font-medium hover:border-accent"
          >
            Download CSV
          </a>
        </Card>
      </div>
    </>
  );
}
