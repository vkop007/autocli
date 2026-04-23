import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printOllamaResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  if (result.action === "models-search") {
    printModelList(result.data?.models);
    return;
  }

  if (result.action === "model") {
    printModelDetail(result.data?.model);
  }
}

function printModelList(value: unknown): void {
  const models = toRecordArray(value);
  if (models.length === 0) {
    console.log("models: none");
    return;
  }

  console.log("models:");
  for (const [index, model] of models.entries()) {
    const id = firstString(model, ["id", "name"]) ?? "unknown";
    console.log(`${index + 1}. ${id}`);

    const meta = [
      toStringArray(model.capabilities).join(", "),
      toStringArray(model.sizes).join(", "),
      firstString(model, ["pulls"]) ? `${firstString(model, ["pulls"])} pulls` : undefined,
      typeof model.tagCount === "number" ? `${model.tagCount} tags` : undefined,
      firstString(model, ["updated"]),
    ].filter((entry): entry is string => Boolean(entry));
    if (meta.length > 0) {
      console.log(`   ${meta.join(" | ")}`);
    }

    const description = firstString(model, ["description"]);
    if (description) {
      console.log(`   ${description}`);
    }

    const url = firstString(model, ["url"]);
    if (url) {
      console.log(`   ${url}`);
    }
  }
}

function printModelDetail(value: unknown): void {
  const model = toRecord(value);
  if (!model) {
    return;
  }

  for (const [label, key] of [
    ["id", "id"],
    ["url", "url"],
    ["pulls", "pulls"],
    ["downloads", "downloads"],
    ["updated", "updated"],
    ["updated at", "updatedAt"],
    ["command", "command"],
  ] as const) {
    const nextValue = firstString(model, [key]);
    if (nextValue) {
      console.log(`${label}: ${nextValue}`);
    }
  }

  const capabilities = toStringArray(model.capabilities);
  if (capabilities.length > 0) {
    console.log(`capabilities: ${capabilities.join(", ")}`);
  }

  const sizes = toStringArray(model.sizes);
  if (sizes.length > 0) {
    console.log(`sizes: ${sizes.join(", ")}`);
  }

  const description = firstString(model, ["description"]);
  if (description) {
    console.log(`description: ${description}`);
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
