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
  // Batch progress: which file is going up, and the fraction of all bytes sent.
  const [progress, setProgress] = useState<{ index: number; count: number; frac: number } | null>(null);
  const [state, setState] = useState<FormState>(null);
  const [confirm, confirmDialog] = useConfirm();

  // XHR rather than fetch, for upload progress. One file per request, so the
  // per-file size limit and the route stay as they are.
  function send(form: FormData, onProgress: (frac: number) => void): Promise<UploadResponse> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/artifacts");
      xhr.upload.onprogress = (ev) => ev.lengthComputable && onProgress(ev.loaded / ev.total);
      xhr.onload = () => {
        let body: UploadResponse["body"] = {};
        try {
          body = JSON.parse(xhr.responseText);
        } catch {}
        resolve({ status: xhr.status, body });
      };
      xhr.onerror = () => resolve({ status: 0, body: { error: "network?" } });
      xhr.send(form);
    });
  }

  const confirmReplace = (names: string[], boxName: string | null) => {
    const where = <span className="font-semibold text-fg">{boxName ?? "the no-box pile"}</span>;
    return confirm({
      title: names.length === 1 ? "replace file?" : "replace files?",
      message:
        names.length === 1 ? (
          <>
            {where} already has <span className="font-semibold text-fg">{names[0]}</span>. replace it with this one? its
            public url and expiry stay the same, so anything fetching it gets the new version.
          </>
        ) : (
          <>
            {where} already has {names.length} of these:{" "}
            <span className="font-semibold text-fg">{names.join(", ")}</span>. replace them? their public urls and expiry
            stay the same. nvm uploads nothing.
          </>
        ),
      confirmLabel: names.length === 1 ? "replace it" : "replace them",
      danger: true,
    });
  };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const files = data.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return setState({ error: "pick a file pls" });
    const tooBig = files.filter((f) => f.size > MAX_BYTES);
    if (tooBig.length) {
      return setState({ error: `too chonky (max ${formatBytes(MAX_BYTES)} each): ${tooBig.map((f) => f.name).join(", ")}` });
    }
    setState(null);

    const targetBox = (data.get("boxId") as string | null) || null;
    const notes = (data.get("notes") as string | null) ?? "";
    const boxName = boxes?.find((b) => b.id === targetBox)?.name ?? (targetBox ? "this box" : null);
    const dupes = files
      .map((f) => safeFilename(f.name))
      .filter((name) => existing.some((a) => a.boxId === targetBox && a.name === name));
    if (dupes.length && !(await confirmReplace(dupes, boxName))) return;

    const totalBytes = files.reduce((n, f) => n + f.size, 0);
    let sentBytes = 0;
    let uploaded = 0;
    let replaced = 0;
    const failed: string[] = [];

    for (const [i, file] of files.entries()) {
      const name = safeFilename(file.name);
      const upload = (replace: boolean) => {
        const form = new FormData();
        form.set("file", file);
        if (targetBox) form.set("boxId", targetBox);
        if (notes) form.set("notes", notes);
        if (replace) form.set("replace", "1");
        return send(form, (frac) =>
          setProgress({ index: i + 1, count: files.length, frac: (sentBytes + frac * file.size) / totalBytes }),
        );
      };
      setProgress({ index: i + 1, count: files.length, frac: sentBytes / totalBytes });
      let res = await upload(dupes.includes(name));
      // Someone else uploaded the same name meanwhile: ask about just this one.
      if (res.status === 409 && res.body.conflict) {
        res = (await confirmReplace([res.body.conflict], boxName))
          ? await upload(true)
          : { status: 0, body: { error: "skipped" } };
      }
      sentBytes += file.size;
      if (res.status === 200) {
        if (res.body.replaced) replaced++;
        else uploaded++;
      } else {
        failed.push(`${name} (${res.body.error ?? `error ${res.status}`})`);
      }
    }
    setProgress(null);

    const counts = [uploaded && `${uploaded} uploaded`, replaced && `${replaced} replaced`].filter(Boolean).join(", ");
    if (failed.length) {
      setState({ error: `${counts ? `${counts}. ` : ""}didn't make it: ${failed.join(", ")}` });
    } else {
      setState({
        ok: files.length === 1 ? `${safeFilename(files[0].name)} ${replaced ? "replaced" : "uploaded"} :)` : `${counts} :)`,
      });
      formRef.current?.reset();
    }
    if (uploaded || replaced) router.refresh();
  }

  const busy = progress !== null;
  const pct = Math.round((progress?.frac ?? 0) * 100);
  return (
    <>
      <form ref={formRef} onSubmit={submit} className="flex flex-col gap-3">
        <div className={`grid gap-3 lg:items-end ${boxId ? "lg:grid-cols-[1fr_1fr_auto]" : "lg:grid-cols-[1fr_200px_1fr_auto]"}`}>
          <Label>
            files (max {formatBytes(MAX_BYTES)} each)
            <Input name="file" type="file" multiple required className="h-auto py-1.5 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-accent file:px-2 file:font-display file:text-accent-fg" />
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
            {busy ? `uploading${progress.count > 1 ? ` ${progress.index}/${progress.count}` : ""}… ${pct}%` : "upload"}
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
