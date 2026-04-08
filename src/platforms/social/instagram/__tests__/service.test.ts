import { describe, expect, test } from "bun:test";

import { extractInstagramCommentId, normalizeInstagramCommentId } from "../service.js";

describe("instagram service helpers", () => {
  test("extracts a created comment id from the web mutation response", () => {
    expect(extractInstagramCommentId({ id: "17979402512833417", status: "ok" })).toBe("17979402512833417");
    expect(extractInstagramCommentId({ pk: "17979402512833417", status: "ok" })).toBe("17979402512833417");
    expect(extractInstagramCommentId({ status: "ok" })).toBeUndefined();
  });

  test("validates Instagram comment ids", () => {
    expect(normalizeInstagramCommentId("17979402512833417")).toBe("17979402512833417");
    expect(() => normalizeInstagramCommentId("abc123")).toThrow("Expected a numeric Instagram comment ID.");
  });
});
