import { describe, expect, test } from "bun:test";

import { readImageMetadata } from "../utils/image-metadata.js";

describe("image metadata", () => {
  test("reads PNG dimensions", () => {
    const bytes = Buffer.alloc(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    bytes.writeUInt32BE(320, 16);
    bytes.writeUInt32BE(180, 20);

    expect(readImageMetadata(bytes, "image/png")).toEqual({
      width: 320,
      height: 180,
    });
  });

  test("rejects invalid image payloads", () => {
    expect(() => readImageMetadata(Buffer.from("bad"), "image/png")).toThrow("Failed to read PNG image metadata.");
  });
});
