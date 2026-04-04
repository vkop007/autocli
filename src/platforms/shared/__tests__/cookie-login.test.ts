import { describe, expect, test } from "bun:test";

import { resolveCookieLoginInput } from "../cookie-login.js";

describe("shared cookie login", () => {
  test("defaults to browser login when no cookie flags are provided", () => {
    expect(resolveCookieLoginInput({})).toEqual({
      account: undefined,
      cookieFile: undefined,
      cookieString: undefined,
      cookieJson: undefined,
      browser: true,
      browserTimeoutSeconds: undefined,
    });
  });

  test("keeps cookie import explicit when a cookie file is provided", () => {
    expect(resolveCookieLoginInput({ cookies: "./x.cookies.json" })).toEqual({
      account: undefined,
      cookieFile: "./x.cookies.json",
      cookieString: undefined,
      cookieJson: undefined,
      browser: false,
      browserTimeoutSeconds: undefined,
    });
  });
});
