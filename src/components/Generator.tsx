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
        className="h-7 rounded border border-border bg-panel px-1.5 text-fg"
        aria-label="Generator preset"
      >
        <option value="strong">Strong</option>
        <option value="shell-safe">Shell-safe</option>
        <option value="passphrase">Passphrase</option>
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
            className="h-7 w-14 rounded border border-border bg-panel px-1.5 text-fg"
          />
        </label>
      )}
      <button
        type="button"
        onClick={() => onGenerate(generatePassword(preset, length))}
        className="h-7 rounded border border-border bg-panel-2 px-2.5 font-medium text-fg hover:border-accent cursor-pointer"
      >
        Generate
      </button>
    </div>
  );
}
