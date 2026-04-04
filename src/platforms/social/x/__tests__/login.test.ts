import { describe, expect, test } from "bun:test";

import { resolveCookieLoginInput } from "../../../shared/cookie-login.js";

describe("x login defaults", () => {
  test("uses browser login by default", () => {
    const input = resolveCookieLoginInput({});

    expect(input.browser).toBe(true);
    expect(input.cookieFile).toBeUndefined();
    expect(input.cookieString).toBeUndefined();
    expect(input.cookieJson).toBeUndefined();
  });

  test("preserves cookie import arguments", () => {
    const input = resolveCookieLoginInput({
      cookies: "./x.cookies.json",
      browser: false,
    });

    expect(input).toEqual({
      account: undefined,
      cookieFile: "./x.cookies.json",
      cookieString: undefined,
      cookieJson: undefined,
      browser: false,
      browserTimeoutSeconds: undefined,
    });
  });
});
