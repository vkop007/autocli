import { describe, expect, it } from "bun:test";

import { AutoCliError } from "../../errors.js";
import {
  BROWSER_NODE_REEXEC_ERROR_CODE,
  isBrowserNodeReexecRequired,
  resolveNodeCliEntrypoint,
} from "../node-browser-reexec.js";

describe("node browser re-exec helpers", () => {
  it("detects the dedicated shared-browser re-exec error", () => {
    const error = new AutoCliError(
      BROWSER_NODE_REEXEC_ERROR_CODE,
      "Shared-browser actions need the Node runtime.",
    );

    expect(isBrowserNodeReexecRequired(error)).toBe(true);
    expect(
      isBrowserNodeReexecRequired(new AutoCliError("BROWSER_LOGIN_FAILED", "No browser.")),
    ).toBe(false);
    expect(isBrowserNodeReexecRequired(new Error("plain error"))).toBe(false);
  });

  it("resolves the bundled Node CLI entrypoint next to the project root", () => {
    const entrypoint = resolveNodeCliEntrypoint("file:///Users/vk/dev/autocli/src/index.ts");

    expect(entrypoint).toBe("/Users/vk/dev/autocli/dist/index.js");
  });
});
