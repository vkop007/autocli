import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export function printRedirectResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const chain = Array.isArray(result.data?.chain) ? (result.data.chain as Array<Record<string, unknown>>) : [];
  if (chain.length === 0) {
    return;
  }

  for (const step of chain) {
    const url = typeof step.url === "string" ? step.url : "-";
    const status = typeof step.status === "number" ? step.status : 0;
    const statusText = typeof step.statusText === "string" ? ` ${step.statusText}` : "";
    const location = typeof step.location === "string" ? ` -> ${step.location}` : "";
    console.log(`${status}${statusText} ${url}${location}`);
  }
}
