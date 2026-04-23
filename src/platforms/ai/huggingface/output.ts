import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printHuggingFaceResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  if (result.action === "models-search") {
    printResourceList("models", result.data?.models);
    return;
  }

  if (result.action === "datasets-search") {
    printResourceList("datasets", result.data?.datasets);
    return;
  }

  if (result.action === "spaces-search") {
    printResourceList("spaces", result.data?.spaces);
    return;
  }

  if (result.action === "model") {
    printResourceDetail(result.data?.model);
    printFiles(result.data?.files);
    return;
  }

  if (result.action === "dataset") {
    printResourceDetail(result.data?.dataset);
    printFiles(result.data?.files);
    return;
  }

  if (result.action === "space") {
    printResourceDetail(result.data?.space);
  }
}

function printResourceList(label: string, value: unknown): void {
  const items = toRecordArray(value);
  if (items.length === 0) {
    console.log(`${label}: none`);
    return;
  }

  console.log(`${label}:`);
  for (const [index, item] of items.entries()) {
    const id = firstString(item, ["id"]) ?? "unknown";
    console.log(`${index + 1}. ${id}`);

    const meta = [
      firstString(item, ["task"]),
      firstString(item, ["library"]),
      firstString(item, ["sdk"]),
      typeof item.downloads === "number" ? `${item.downloads} downloads` : undefined,
      typeof item.likes === "number" ? `${item.likes} likes` : undefined,
      firstString(item, ["lastModified"]),
    ].filter((entry): entry is string => Boolean(entry));
    if (meta.length > 0) {
      console.log(`   ${meta.join(" | ")}`);
    }

    const url = firstString(item, ["url"]);
    if (url) {
      console.log(`   ${url}`);
    }
  }
}

function printResourceDetail(value: unknown): void {
  const item = toRecord(value);
  if (!item) {
    return;
  }

  for (const [label, key] of [
    ["id", "id"],
    ["url", "url"],
    ["author", "author"],
    ["task", "task"],
    ["library", "library"],
    ["sdk", "sdk"],
    ["license", "license"],
    ["last modified", "lastModified"],
  ] as const) {
    const nextValue = firstString(item, [key]);
    if (nextValue) {
      console.log(`${label}: ${nextValue}`);
    }
  }

  const metrics = [
    typeof item.downloads === "number" ? `${item.downloads} downloads` : undefined,
    typeof item.likes === "number" ? `${item.likes} likes` : undefined,
  ].filter((entry): entry is string => Boolean(entry));
  if (metrics.length > 0) {
    console.log(`metrics: ${metrics.join(" | ")}`);
  }

  const tags = toStringArray(item.tags);
  if (tags.length > 0) {
    console.log(`tags: ${tags.slice(0, 12).join(", ")}`);
  }
}

function printFiles(value: unknown): void {
  const files = toRecordArray(value);
  if (files.length === 0) {
    return;
  }

  console.log("files:");
  for (const file of files.slice(0, 20)) {
    const path = firstString(file, ["path"]) ?? "unknown";
    const size = typeof file.size === "number" ? ` (${file.size} bytes)` : "";
    console.log(`  ${path}${size}`);
  }
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function toRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function firstString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}
