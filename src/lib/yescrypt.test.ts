import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { yescryptCrypt, yescryptHash } from "./yescrypt";

// Generated with libxcrypt on Debian trixie: Perl crypt() over fixed settings,
// plus `mkpasswd -m yescrypt -R 1..7`. Columns: password (hex), setting,
// expected crypt() output ("*0" where libxcrypt rejects the setting).
const vectors = readFileSync(path.join(import.meta.dirname, "yescrypt.vectors.tsv"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [hex, setting, expected] = line.split("\t");
    return { password: Buffer.from(hex, "hex").toString("utf8"), setting, expected };
  });

describe("yescrypt", () => {
  it("matches libxcrypt on every reference vector", () => {
    expect(vectors.length).toBeGreaterThan(80);
    for (const { password, setting, expected } of vectors) {
      if (expected === "*0") expect(() => yescryptCrypt(password, setting), setting).toThrow();
      else expect(yescryptCrypt(password, setting), `${JSON.stringify(password)} ${setting}`).toBe(expected);
    }
  }, 60_000);

  it("generates default-cost hashes that verify", () => {
    const hash = yescryptHash("hunter2");
    expect(hash).toMatch(/^\$y\$j9T\$[./0-9A-Za-z]{22}\$[./0-9A-Za-z]{43}$/);
    expect(yescryptCrypt("hunter2", hash)).toBe(hash);
    expect(yescryptCrypt("hunter3", hash)).not.toBe(hash);
  });

  it("uses a fresh salt each time", () => {
    expect(yescryptHash("same", 1)).not.toBe(yescryptHash("same", 1));
  });

  it("rejects out-of-range costs", () => {
    expect(() => yescryptHash("x", 0)).toThrow();
    expect(() => yescryptHash("x", 12)).toThrow();
  });
});
