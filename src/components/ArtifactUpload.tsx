"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormMessage, Input, Label, Select } from "@/components/ui";
import { useConfirm } from "@/components/useConfirm";
import { formatBytes, safeFilename } from "@/lib/filename";
import type { FormState } from "@/lib/types";

// Mirrors MAX_ARTIFACT_BYTES in src/lib/artifacts.ts (server-only), which is what's enforced.
const MAX_BYTES = 50 * 1024 * 1024;

type UploadResponse = { status: number; body: { error?: string; name?: string; conflict?: string; replaced?: boolean } };

export function ArtifactUpload({
  boxes,
  boxId,
  existing,
}: {
  boxes?: { id: string; name: string }[];
  boxId?: string;
  /** Files already uploaded, so a same-name upload can be confirmed before sending the bytes. */
  existing: { boxId: string | null; name: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [state, setState] = useState<FormState>(null);
  const [confirm, confirmDialog] = useConfirm();

  // XHR rather than fetch, for upload progress.
  function send(form: FormData): Promise<UploadResponse> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/artifacts");
      xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(ev.loaded / ev.total);
      xhr.onload = () => {
        let body: UploadResponse["body"] = {};
        try {
          body = JSON.parse(xhr.responseText);
        } catch {}
        resolve({ status: xhr.status, body });
      };
      xhr.onerror = () => resolve({ status: 0, body: { error: "upload failed. network?" } });
      setProgress(0);
      xhr.send(form);
    });
  }

  const confirmReplace = (name: string, boxName: string | null) =>
    confirm({
      title: "replace file?",
      message: (
        <>
          <span className="font-semibold text-fg">{boxName ?? "the no-box pile"}</span> already has{" "}
          <span className="font-semibold text-fg">{name}</span>. replace it with this one? its public url and expiry stay the
          same, so anything fetching it gets the new version.
        </>
      ),
      confirmLabel: "replace it",
      danger: true,
    });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return setState({ error: "pick a file pls" });
    if (file.size > MAX_BYTES) return setState({ error: `too chonky. max ${formatBytes(MAX_BYTES)}` });
    setState(null);

    const targetBox = (form.get("boxId") as string | null) || null;
    const boxName = boxes?.find((b) => b.id === targetBox)?.name ?? (targetBox ? "this box" : null);
    const name = safeFilename(file.name);
    if (existing.some((a) => a.boxId === targetBox && a.name === name)) {
      if (!(await confirmReplace(name, boxName))) return;
      form.set("replace", "1");
    }

    let res = await send(form);
    // Someone else uploaded the same name meanwhile: ask, then resend.
    if (res.status === 409 && res.body.conflict && !form.has("replace")) {
      setProgress(null);
      if (!(await confirmReplace(res.body.conflict, boxName))) return;
      form.set("replace", "1");
      res = await send(form);
    }
    setProgress(null);
    if (res.status !== 200) return setState({ error: res.body.error ?? `upload failed (${res.status})` });
    setState({ ok: `${res.body.name} ${res.body.replaced ? "replaced" : "uploaded"} :)` });
    formRef.current?.reset();
    router.refresh();
  }

  const busy = progress !== null;
  const pct = Math.round((progress ?? 0) * 100);
  return (
    <>
      <form ref={formRef} onSubmit={submit} className="flex flex-col gap-3">
        <div className={`grid gap-3 lg:items-end ${boxId ? "lg:grid-cols-[1fr_1fr_auto]" : "lg:grid-cols-[1fr_200px_1fr_auto]"}`}>
          <Label>
            file (max {formatBytes(MAX_BYTES)})
            <Input name="file" type="file" required className="h-auto py-1.5 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-accent file:px-2 file:font-display file:text-accent-fg" />
          </Label>
          {boxId ? (
            <input type="hidden" name="boxId" value={boxId} />
          ) : (
            boxes && (
              <Label>
                box (optional)
                <Select name="boxId" defaultValue="">
                  <option value="">— no box —</option>
                  {boxes.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Label>
            )
          )}
          <Label>
            notes
            <Input name="notes" maxLength={2000} placeholder="what is it, where does it go…" />
          </Label>
          <Button disabled={busy} className="whitespace-nowrap">
            {busy ? `uploading… ${pct}%` : "upload"}
          </Button>
        </div>
        {busy && (
          <div className="h-2 overflow-hidden rounded-full border-2 border-border bg-panel-2">
            <div className="h-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        )}
        <FormMessage state={state} />
      </form>
      {/* outside the form, or its buttons would submit it */}
      {confirmDialog}
    </>
  );
}
