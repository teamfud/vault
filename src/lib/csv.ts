import Papa from "papaparse";

export const CSV_COLUMNS = ["box", "address", "os", "kind", "service", "username", "password", "notes"] as const;

export type CsvRow = {
  line: number;
  box: string;
  address: string;
  os: string;
  kind: "USER" | "SERVICE";
  service: string;
  username: string;
  password: string;
  notes: string;
};

const ALIASES: Record<string, (typeof CSV_COLUMNS)[number]> = {
  box: "box",
  host: "box",
  hostname: "box",
  name: "box",
  address: "address",
  ip: "address",
  os: "os",
  kind: "kind",
  type: "kind",
  service: "service",
  username: "username",
  user: "username",
  account: "username",
  password: "password",
  pass: "password",
  secret: "password",
  notes: "notes",
  note: "notes",
};

export function parseCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => ALIASES[h.trim().toLowerCase()] ?? h.trim().toLowerCase(),
  });
  const errors = parsed.errors.map((e) => `line ${(e.row ?? 0) + 2}: ${e.message.toLowerCase()}`);
  const fields = parsed.meta.fields ?? [];
  for (const required of ["box", "username", "password"]) {
    if (!fields.includes(required)) errors.push(`missing required column “${required}”`);
  }
  if (errors.length) return { rows: [], errors };

  const rows: CsvRow[] = [];
  parsed.data.forEach((r, i) => {
    const line = i + 2; // header is line 1
    const get = (k: string) => (r[k] ?? "").trim();
    const kindRaw = get("kind").toLowerCase();
    const row: CsvRow = {
      line,
      box: get("box"),
      address: get("address"),
      os: get("os"),
      kind: kindRaw === "service" || kindRaw === "svc" ? "SERVICE" : "USER",
      service: get("service"),
      username: get("username"),
      password: r.password ?? "", // not trimmed: whitespace may be significant
      notes: get("notes"),
    };
    if (!row.box) errors.push(`line ${line}: missing box`);
    else if (!row.username) errors.push(`line ${line}: missing username`);
    else if (!row.password) errors.push(`line ${line}: missing password`);
    else rows.push(row);
  });
  return { rows, errors };
}

export function toCsv(rows: Omit<CsvRow, "line">[]): string {
  return Papa.unparse({ fields: [...CSV_COLUMNS], data: rows.map((r) => CSV_COLUMNS.map((c) => r[c])) });
}
