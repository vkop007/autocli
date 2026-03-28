import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printSslResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const data = result.data ?? {};
  for (const key of ["host", "port", "protocol", "cipher", "validFrom", "validTo", "daysRemaining", "serialNumber", "fingerprint256"]) {
    if (data[key] !== undefined && data[key] !== null) {
      console.log(`${key}: ${String(data[key])}`);
    }
  }

  if (typeof data.authorized === "boolean") {
    console.log(`authorized: ${data.authorized ? "yes" : "no"}`);
  }
  if (typeof data.authorizationError === "string" && data.authorizationError.length > 0) {
    console.log(`authorizationError: ${data.authorizationError}`);
  }

  const subject = toRecord(data.subject);
  if (Object.keys(subject).length > 0) {
    console.log(`subject: ${JSON.stringify(subject)}`);
  }
  const issuer = toRecord(data.issuer);
  if (Object.keys(issuer).length > 0) {
    console.log(`issuer: ${JSON.stringify(issuer)}`);
  }

  const altNames = Array.isArray(data.altNames) ? data.altNames.filter((value): value is string => typeof value === "string") : [];
  if (altNames.length > 0) {
    console.log(`altNames: ${altNames.join(", ")}`);
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
