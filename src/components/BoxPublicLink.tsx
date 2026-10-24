"use client";

import { useSyncExternalStore, useTransition } from "react";
import { rotateBoxLink } from "@/app/(app)/artifacts/actions";
import { Button } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { useConfirm } from "@/components/useConfirm";

const noSubscribe = () => () => {};

/** The box's public base URL (/d/<token>/), with a button to rotate it. */
export function BoxPublicLink({ boxId, boxName, basePath }: { boxId: string; boxName: string; basePath: string | null }) {
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const [pending, start] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  if (!basePath) return null;
  const base = origin + basePath;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
      public base url:
      <code className="max-w-full truncate rounded border border-border/40 bg-panel-2 px-1.5 py-0.5 text-[11px] text-fg" title={base}>
        {base}
      </code>
      <CopyButton getText={() => base} />
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={async () => {
          const ok = await confirm({
            title: "new box link",
            message: `every public url on ${boxName} changes, and the old ones stop working right away. anything fetching them (edr, scripts on the box) needs the new url.`,
            confirmLabel: "rotate it",
            danger: true,
          });
          if (ok) start(() => rotateBoxLink(boxId));
        }}
      >
        new box link
      </Button>
      {confirmDialog}
    </div>
  );
}
