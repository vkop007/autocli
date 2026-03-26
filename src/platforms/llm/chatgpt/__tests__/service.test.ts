import { describe, expect, test } from "bun:test";

import {
  generateFakeSentinelToken,
  parseChatGptConversationStream,
  solveChatGptSentinelChallenge,
} from "../service.js";

describe("chatgpt service helpers", () => {
  test("generates a browserless sentinel token", () => {
    const token = generateFakeSentinelToken();
    expect(token.startsWith("gAAAAAC")).toBe(true);
    expect(token.length).toBeGreaterThan(40);
  });

  test("solves an easy sentinel proof-of-work challenge", () => {
    const token = solveChatGptSentinelChallenge("seed", "ffff");
    expect(token.startsWith("gAAAAAB")).toBe(true);
    expect(token.length).toBeGreaterThan(20);
  });

  test("parses assistant output from the event stream", () => {
    const parsed = parseChatGptConversationStream(`
event: delta_encoding
data: "v1"

event: delta
data: {"p":"","o":"add","v":{"message":{"id":"sys-1","author":{"role":"system"},"content":{"content_type":"text","parts":[""]},"status":"finished_successfully","metadata":{}},"conversation_id":"conv-123","error":null,"error_code":null},"c":0}

event: delta
data: {"v":{"message":{"id":"assistant-123","author":{"role":"assistant"},"content":{"content_type":"text","parts":["Hello"]},"status":"in_progress","metadata":{"resolved_model_slug":"i-mini"}},"conversation_id":"conv-123"}}

event: delta
data: {"o":"append","p":"/message/content/parts/0","v":" world"}

data: {"message":{"id":"assistant-123","author":{"role":"assistant"},"content":{"content_type":"text","parts":["Hello world"]},"status":"finished_successfully","metadata":{"resolved_model_slug":"i-mini"}},"conversation_id":"conv-123"}
    `);

    expect(parsed).toEqual({
      outputText: "Hello world",
      conversationId: "conv-123",
      assistantMessageId: "assistant-123",
      model: "i-mini",
    });
  });
});
