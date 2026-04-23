import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "bun:test";

import { getPlatformDefinitions } from "../platforms/index.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const providerReferenceDir = join(repoRoot, "skills", "mikacli", "references", "providers");

describe("MikaCLI skill provider references", () => {
  test("includes a generated provider reference file for every platform", () => {
    for (const definition of getPlatformDefinitions()) {
      expect(existsSync(join(providerReferenceDir, `${definition.id}.md`))).toBe(true);
    }
  });

  test("includes a generated provider index", () => {
    expect(existsSync(join(providerReferenceDir, "index.md"))).toBe(true);
  });

  test("documents nested provider command groups", () => {
    const huggingFaceReference = readFileSync(join(providerReferenceDir, "huggingface.md"), "utf8");

    expect(huggingFaceReference).toContain("mikacli ai huggingface models search");
    expect(huggingFaceReference).toContain("mikacli ai huggingface datasets search");
    expect(huggingFaceReference).toContain("mikacli ai huggingface spaces search");
  });
});
