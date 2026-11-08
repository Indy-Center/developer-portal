import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  new URL("../../src/content/docs/patterns/public-api.md", import.meta.url),
  "utf8",
);

// Each route's section on the page: its field table and its JSON example.
const routes = page
  .split(/^## /m)
  .slice(1)
  .filter((section) => section.includes("```json"))
  .map((section) => ({
    heading: section.slice(0, section.indexOf("\n")),
    fields: [...section.matchAll(/^\| `(\w+)` +\|/gm)].map((m) => m[1]),
    example: section.match(/```json\n([\s\S]*?)```/)![1],
  }));

describe("the public API page", () => {
  it("has an example for each route", () => {
    expect(routes.map((r) => r.heading)).toEqual(["Positions", "Credentials"]);
  });

  it.each(routes)(
    "lists exactly the fields its $heading example has",
    ({ fields, example }) => {
      const rows: unknown = JSON.parse(example);
      expect(Array.isArray(rows), "the example is a list, as served").toBe(
        true,
      );
      const first = (rows as Record<string, unknown>[])[0];
      expect([...fields].sort()).toEqual(Object.keys(first).sort());
    },
  );
});
