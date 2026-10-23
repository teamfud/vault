import { describe, expect, it } from "vitest";
import { charsets, generatePassword } from "./generate";

const hasAny = (s: string, set: string) => [...s].some((c) => set.includes(c));

describe("generatePassword", () => {
  it("strong passwords contain every class and honor length", () => {
    for (let i = 0; i < 200; i++) {
      const p = generatePassword("strong", 20);
      expect(p).toHaveLength(20);
      for (const set of [charsets.LOWER, charsets.UPPER, charsets.DIGITS, charsets.SYMBOLS]) expect(hasAny(p, set)).toBe(true);
    }
  });

  it("shell-safe passwords avoid shell metacharacters", () => {
    for (let i = 0; i < 500; i++) {
      expect(generatePassword("shell-safe", 24)).not.toMatch(/['"`$\\!&|;<>(){}\s*?#~]/);
    }
  });

  it("enforces a minimum length", () => {
    expect(generatePassword("strong", 3)).toHaveLength(8);
  });

  it("passphrases look like word-word-word-word-NN", () => {
    expect(generatePassword("passphrase")).toMatch(/^([a-zA-Z]+-){4}\d{2}$/);
  });

  it("is roughly uniform", () => {
    const counts = new Map<string, number>();
    const n = 2000;
    for (let i = 0; i < n; i++) for (const c of generatePassword("strong", 40)) counts.set(c, (counts.get(c) ?? 0) + 1);
    const values = [...counts.values()];
    // Every character should appear; none wildly over-represented.
    expect(counts.size).toBe(charsets.LOWER.length + charsets.UPPER.length + charsets.DIGITS.length + charsets.SYMBOLS.length);
    expect(Math.max(...values) / Math.min(...values)).toBeLessThan(1.5);
  });
});
