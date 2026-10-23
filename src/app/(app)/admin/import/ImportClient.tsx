"use client";

import { useState, useTransition } from "react";
import { commitImport, previewImport, type ImportResult } from "./actions";
import { Badge, Button, Card, Textarea } from "@/components/ui";

const SAMPLE = `box,address,os,kind,service,username,password,notes
web01,10.0.1.10,Ubuntu 22.04,user,ssh,root,ChangeMe!1,
web01,10.0.1.10,Ubuntu 22.04,service,mysql,wordpress,wp-db-pass,used by wp-config.php
dc01,10.0.1.5,Windows Server 2019,user,AD,Administrator,P@ssw0rd,domain admin`;

export function ImportClient() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  const counts = result && {
    create: result.plan.filter((p) => p.action === "create").length,
    rotate: result.plan.filter((p) => p.action === "rotate").length,
    unchanged: result.plan.filter((p) => p.action === "unchanged").length,
    boxes: new Set(result.plan.filter((p) => p.newBox).map((p) => p.box)).size,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-9 cursor-pointer items-center rounded-md border-2 border-border bg-panel px-4 font-display text-sm shadow-sticker hover:-translate-x-px hover:-translate-y-px">
          pick a csv…
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                setText(await file.text());
                setResult(null);
              }
              e.target.value = "";
            }}
          />
        </label>
        <span className="text-xs text-muted">or paste it below</span>
        <button type="button" className="text-xs underline decoration-accent decoration-2 cursor-pointer" onClick={() => setText(SAMPLE)}>
          gimme a sample
        </button>
      </div>
      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        rows={10}
        spellCheck={false}
        placeholder="box,address,os,kind,service,username,password,notes"
        className="font-mono text-xs"
      />
      <div className="flex gap-2">
        <Button variant="secondary" disabled={!text || pending} onClick={() => start(async () => setResult(await previewImport(text)))}>
          dry run
        </Button>
        <Button
          disabled={!result || result.errors.length > 0 || result.committed || pending}
          onClick={() =>
            start(async () => {
              const r = await commitImport(text);
              setResult(r);
              if (r.committed) setText("");
            })
          }
        >
          send it
        </Button>
      </div>

      {result && result.errors.length > 0 && (
        <Card className="border-danger p-4 text-danger">
          <ul className="list-inside list-disc">
            {result.errors.slice(0, 50).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Card>
      )}

      {result && counts && result.errors.length === 0 && (
        <Card className="p-4">
          <p className="mb-3">
            {result.committed ? <span className="text-ok">imported! </span> : "dry run: "}
            {counts.create} new, {counts.rotate} rotated, {counts.unchanged} unchanged
            {counts.boxes > 0 && `, ${counts.boxes} new box${counts.boxes === 1 ? "" : "es"}`}.
          </p>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-border/20">
                {result.plan.map((p) => (
                  <tr key={p.line}>
                    <td className="py-1.5 pr-3 text-muted">{p.line}</td>
                    <td className="py-1.5 pr-3">
                      {p.box} {p.newBox && <Badge tone="accent">new box!</Badge>}
                    </td>
                    <td className="py-1.5 pr-3">{p.username}</td>
                    <td className="py-1.5 pr-3 text-muted">{p.service}</td>
                    <td className="py-1.5">
                      <Badge tone={p.action === "create" ? "ok" : p.action === "rotate" ? "warn" : "neutral"}>{p.action}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
