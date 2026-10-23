import { requireAdmin } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { ImportClient } from "./ImportClient";

export default async function ImportPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="import / export" sub="bulk mode, engaged" />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="p-5">
          <h2 className="mb-1 font-display text-lg">import csv</h2>
          <p className="mb-4 text-muted">
            columns: <code className="text-fg">box, address, os, kind, service, username, password, notes</code>. only box,
            username and password are required. rows matching an existing box + service + username rotate that cred
            (the old one goes to history). boxes get made as needed.
          </p>
          <ImportClient />
        </Card>
        <Card className="h-fit p-5">
          <h2 className="mb-1 font-display text-lg">export</h2>
          <p className="mb-4 text-muted">
            downloads every cred <strong className="text-danger">in plaintext (!!)</strong>. it gets logged. keep the file
            safe and delete it when ur done.
          </p>
          <a
            href="/api/export"
            className="inline-flex h-9 items-center rounded-md border-2 border-border bg-panel px-4 font-display text-sm shadow-sticker hover:-translate-x-px hover:-translate-y-px active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          >
            download csv
          </a>
        </Card>
      </div>
    </>
  );
}
