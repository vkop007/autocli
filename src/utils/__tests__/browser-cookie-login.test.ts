import { describe, expect, it } from "bun:test";

import { hasDetectedAuthenticatedState } from "../browser-cookie-login.js";

describe("browser cookie login detection", () => {
  it("does not treat GitHub bootstrap cookies as a successful login", () => {
    const detected = hasDetectedAuthenticatedState(
      [
        { name: "_gh_sess", value: "anon-session", domain: ".github.com" },
        { name: "logged_in", value: "no", domain: ".github.com" },
      ],
      ["user_session", "logged_in"],
      [],
      "github.com",
      {
        localStorage: {},
        sessionStorage: {},
      },
    );

    expect(detected).toBe(false);
  });

  it("treats a real GitHub user_session cookie as authenticated", () => {
    const detected = hasDetectedAuthenticatedState(
      [
        { name: "_gh_sess", value: "anon-session", domain: ".github.com" },
        { name: "user_session", value: "signed-in-session", domain: ".github.com" },
      ],
      ["user_session", "logged_in"],
      [],
      "github.com",
      {
        localStorage: {},
        sessionStorage: {},
      },
    );

    expect(detected).toBe(true);
  });

  it("supports storage-backed login detection for platforms like DeepSeek", () => {
    const detected = hasDetectedAuthenticatedState(
      [{ name: "visitor_id", value: "abc123", domain: ".deepseek.com" }],
      [],
      ["userToken"],
      "deepseek.com",
      {
        localStorage: {
          userToken: "browser-user-token",
        },
        sessionStorage: {},
      },
    );

    expect(detected).toBe(true);
  });
});
