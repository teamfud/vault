"use client";

import { useState } from "react";
import { generatePassword, type Preset } from "@/lib/generate";

/** Small control that fills a password input with a generated value. */
export function Generator({ onGenerate }: { onGenerate: (value: string) => void }) {
  const [preset, setPreset] = useState<Preset>("strong");
  const [length, setLength] = useState(20);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      <select
        value={preset}
        onChange={(e) => setPreset(e.target.value as Preset)}
        className="h-7 rounded border-2 border-border bg-panel px-1.5 text-fg"
        aria-label="generator preset"
      >
        <option value="strong">strong</option>
        <option value="shell-safe">shell-safe</option>
        <option value="passphrase">passphrase</option>
      </select>
      {preset !== "passphrase" && (
        <label className="flex items-center gap-1">
          len
          <input
            type="number"
            min={8}
            max={128}
            value={length}
            onChange={(e) => setLength(Number(e.target.value) || 20)}
            className="h-7 w-14 rounded border-2 border-border bg-panel px-1.5 text-fg"
          />
        </label>
      )}
      <button
        type="button"
        onClick={() => onGenerate(generatePassword(preset, length))}
        className="h-7 rounded border-2 border-border bg-accent px-2.5 font-display text-accent-fg cursor-pointer active:translate-y-px"
      >
        generate!
      </button>
    </div>
  );
}
