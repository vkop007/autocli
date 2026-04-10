import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SCAN_ROOTS = ["src", "skills", "README.md", "scripts"] as const;
const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".md", ".json", ".yml", ".yaml"]);
const IGNORED_SCAN_FILES = new Set(["src/__tests__/secret-safe-examples.test.ts"]);

const BANNED_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Slack token prefix", pattern: /\bxox(?:a|b|c|e|o|p|r|s)-/ },
  { label: "Slack app token prefix", pattern: /\bxapp-/ },
  { label: "GitHub personal token prefix", pattern: /\bgh[pousr]_/ },
  { label: "GitLab PAT prefix", pattern: /\bglpat-/ },
  { label: "Hard-coded personal Atlassian workspace", pattern: /officialgxdyt\.atlassian\.net/ },
  { label: "Hard-coded local user path", pattern: /\/Users\/vk\// },
];

const APP_PASSWORD_LINE = /\b[a-z0-9]{4}(?:-[a-z0-9]{4}){3}\b/;

describe("secret-safe fixtures and examples", () => {
  test("tracked examples avoid secret-like placeholders and personal local paths", () => {
    const violations: string[] = [];

    for (const relativePath of collectFiles(ROOT, SCAN_ROOTS)) {
      if (IGNORED_SCAN_FILES.has(relativePath)) {
        continue;
      }

      const content = readFileSync(join(ROOT, relativePath), "utf8");
      const lines = content.split(/\r?\n/);

      for (const banned of BANNED_PATTERNS) {
        if (banned.pattern.test(content)) {
          violations.push(`${relativePath}: matched ${banned.label}`);
        }
      }

      for (const [index, line] of lines.entries()) {
        if (/(?:app[- ]password|--app-password)/i.test(line) && APP_PASSWORD_LINE.test(line)) {
          violations.push(`${relativePath}:${index + 1}: app-password example looks like a real credential`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

function collectFiles(root: string, entries: readonly string[]): string[] {
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = join(root, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      walkDirectory(root, absolutePath, files);
      continue;
    }

    files.push(entry);
  }

  return files;
}

function walkDirectory(root: string, directory: string, files: string[]): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") {
      continue;
    }

    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(root, absolutePath, files);
      continue;
    }

    if (![...ALLOWED_EXTENSIONS].some((extension) => absolutePath.endsWith(extension))) {
      continue;
    }

    files.push(absolutePath.slice(root.length + 1));
  }
}
