import { describe, expect, it } from "vitest";
import { projects } from "../../src/data/projects";

describe("project registry", () => {
  it("names a replacement for every retired project", () => {
    const retired = projects.filter(
      (p) => p.status === "deprecated" || p.status === "archived",
    );
    expect(retired.length).toBeGreaterThan(0);
    for (const p of retired) {
      expect(
        p.replacedBy,
        `${p.name} is ${p.status} but names no replacement`,
      ).toBeTruthy();
    }
  });

  it("has unique names", () => {
    const names = projects.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("has parseable urls", () => {
    for (const p of projects) {
      expect(() => new URL(p.repo), `${p.name} repo url`).not.toThrow();
      if (p.url)
        expect(() => new URL(p.url!), `${p.name} live url`).not.toThrow();
    }
  });

  it("links each entry to its own repo in the Indy-Center org", () => {
    for (const p of projects) {
      expect(p.repo).toBe(`https://github.com/Indy-Center/${p.name}`);
    }
  });
});
