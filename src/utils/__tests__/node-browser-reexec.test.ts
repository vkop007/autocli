import { describe, expect, it } from "bun:test";

import { AutoCliError } from "../../errors.js";
import {
  BROWSER_NODE_REEXEC_ERROR_CODE,
  buildNodeBrowserReexecArgs,
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

  it("adds a valid localStorage file when re-execing browser actions under Node", () => {
    const args = buildNodeBrowserReexecArgs(
      "/Users/vk/dev/autocli/dist/index.js",
      ["/Users/vk/.bun/bin/bun", "src/index.ts", "login", "--browser"],
      "/Users/vk/.autocli/cache/node-localstorage.json",
    );

    expect(args).toEqual([
      "--localstorage-file=/Users/vk/.autocli/cache/node-localstorage.json",
      "/Users/vk/dev/autocli/dist/index.js",
      "login",
      "--browser",
    ]);
  });
});
