import { describe, expect, it } from "vitest";
import { contentDisposition, formatBytes, safeFilename } from "./filename";

describe("safeFilename", () => {
  it("keeps ordinary names", () => {
    expect(safeFilename("linpeas.sh")).toBe("linpeas.sh");
    expect(safeFilename("my tool v2.tar.gz")).toBe("my tool v2.tar.gz");
    expect(safeFilename("résumé.pdf")).toBe("résumé.pdf");
  });

  it("drops directories and traversal", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("C:\\Users\\x\\evil.exe")).toBe("evil.exe");
    expect(safeFilename("..")).toBe("file");
  });

  it("strips header-breaking and hidden-file characters", () => {
    expect(safeFilename('a"b\r\nc.txt')).toBe("abc.txt");
    expect(safeFilename(".bashrc")).toBe("bashrc");
    expect(safeFilename("")).toBe("file");
  });

  it("caps the length", () => {
    expect(safeFilename("a".repeat(500)).length).toBe(200);
  });
});

describe("contentDisposition", () => {
  it("gives an ascii fallback and a utf-8 name", () => {
    expect(contentDisposition("résumé.pdf")).toBe(`attachment; filename="r_sum_.pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf`);
  });
});

describe("formatBytes", () => {
  it("formats", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(30 * 1024 * 1024)).toBe("30.0 MB");
  });
});
