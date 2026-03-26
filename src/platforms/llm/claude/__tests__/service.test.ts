import { describe, expect, test } from "bun:test";

import { parseClaudeCompletionStream } from "../service.js";

describe("claude service helpers", () => {
  test("parses streamed completion fragments", () => {
    const parsed = parseClaudeCompletionStream(`
event: completion
data: {"completion":"Hello","model":"claude-sonnet-4"}

data: {"completion":" world"}
data: {"stop_reason":"stop_sequence"}
    `);

    expect(parsed).toEqual({
      outputText: "Hello world",
      model: "claude-sonnet-4",
    });
  });

  test("raises a rate-limit error from the stream payload", () => {
    expect(() =>
      parseClaudeCompletionStream(`
data: {"error":{"message":"Rate limited","resets_at":1774501991}}
      `),
    ).toThrow("Claude rate limited this session.");
  });
});
