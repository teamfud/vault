import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";

describe("csv", () => {
  it("parses with aliases and defaults", () => {
    const { rows, errors } = parseCsv("Host,IP,User,Pass,Type\nweb01,10.0.0.1,root,toor,svc\n");
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ box: "web01", address: "10.0.0.1", username: "root", password: "toor", kind: "SERVICE" });
  });

  it("reports missing columns and fields", () => {
    expect(parseCsv("box,username\na,b").errors[0]).toMatch(/password/);
    expect(parseCsv("box,username,password\na,,x").errors[0]).toMatch(/line 2: missing username/);
  });

  it("round-trips tricky passwords", () => {
    const rows = [
      { box: "b", address: "", os: "", kind: "USER" as const, service: "", username: "u", password: ' a,"b"\nc ', notes: "" },
    ];
    const back = parseCsv(toCsv(rows)).rows[0];
    expect(back.password).toBe(rows[0].password);
  });
});
