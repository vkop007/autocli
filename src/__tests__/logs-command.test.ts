import { describe, expect, test } from "bun:test";
import { Command } from "commander";

import { createLogsCommand, normalizeActionLogStatus, parseSinceWindow } from "../commands/logs.js";

describe("logs command", () => {
  test("registers the expected subcommands", () => {
    const command = createLogsCommand();
    expect(command.name()).toBe("logs");
    expect(command.commands.map((subcommand: Command) => subcommand.name())).toEqual(["show", "clear"]);
  });

  test("parses relative since windows", () => {
    const now = new Date("2026-04-13T12:00:00.000Z");
    expect(parseSinceWindow("15m", now)?.toISOString()).toBe("2026-04-13T11:45:00.000Z");
    expect(parseSinceWindow("2h", now)?.toISOString()).toBe("2026-04-13T10:00:00.000Z");
    expect(parseSinceWindow("7d", now)?.toISOString()).toBe("2026-04-06T12:00:00.000Z");
  });

  test("normalizes supported statuses", () => {
    expect(normalizeActionLogStatus("success")).toBe("success");
    expect(normalizeActionLogStatus("FAILED")).toBe("failed");
  });
});
