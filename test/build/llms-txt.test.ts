import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Reads the built site, so run `npm run build` first (CI does).
const dist = new URL("../../dist/", import.meta.url);

function read(file: string) {
  const url = new URL(file, dist);
  expect(existsSync(url), `${file} missing; run \`npm run build\``).toBe(true);
  return readFileSync(url, "utf8");
}

describe("llms.txt", () => {
  it("is published, naming the site and linking the full-text variant", () => {
    const llmsTxt = read("llms.txt");
    expect(llmsTxt).toMatch(/^# Indy Center Tech/);
    expect(llmsTxt).toContain("https://tech.flyindycenter.com/llms-full.txt");
  });

  it("publishes the whole site as one file", () => {
    expect(read("llms-full.txt")).toContain("Definition of done");
  });
});
