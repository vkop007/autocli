import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printMetadataResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  for (const key of ["title", "description", "canonicalUrl", "faviconUrl", "htmlLang", "finalUrl"]) {
    const value = data[key];
    if (typeof value === "string" && value.length > 0) {
      console.log(`${key}: ${value}`);
    }
  }

  const openGraph = toRecord(data.openGraph);
  if (Object.keys(openGraph).length > 0) {
    console.log("open-graph:");
    for (const [key, value] of Object.entries(openGraph)) {
      console.log(`  ${key}: ${String(value)}`);
    }
  }

  const twitter = toRecord(data.twitter);
  if (Object.keys(twitter).length > 0) {
    console.log("twitter:");
    for (const [key, value] of Object.entries(twitter)) {
      console.log(`  ${key}: ${String(value)}`);
    }
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
