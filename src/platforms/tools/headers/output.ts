import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printHeadersResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  if (typeof data.status === "number") {
    console.log(`status: ${data.status}${typeof data.statusText === "string" ? ` ${data.statusText}` : ""}`);
  }
  if (typeof data.finalUrl === "string") {
    console.log(`url: ${data.finalUrl}`);
  }

  const headers = toRecord(data.headers);
  const entries = Object.entries(headers).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) {
    return;
  }

  console.log("headers:");
  for (const [key, value] of entries) {
    console.log(`  ${key}: ${String(value)}`);
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
