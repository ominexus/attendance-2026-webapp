import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("index.html", () => {
  it("does not ship unresolved Vite placeholders", () => {
    const html = readFileSync(resolve(__dirname, "../../index.html"), "utf8");

    expect(html).not.toContain("%VITE_");
  });
});
