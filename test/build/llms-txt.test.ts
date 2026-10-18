import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Reads the built site, so run `npm run build` first (CI does).
const dist = new URL("../../dist/", import.meta.url);
const read = (file: string) => readFileSync(new URL(file, dist), "utf8");

describe("llms.txt", () => {
  it("is published, naming the site and linking the full-text variant", () => {
    expect(
      existsSync(new URL("index.html", dist)),
      "run `npm run build` first",
    ).toBe(true);
    const index = read("llms.txt");
    expect(index).toMatch(/^# Indy Center Tech/);
    expect(index).toContain("https://tech.flyindycenter.com/llms-full.txt");
  });

  it("publishes the whole site as one file", () => {
    expect(read("llms-full.txt")).toContain("Definition of done");
  });
});
