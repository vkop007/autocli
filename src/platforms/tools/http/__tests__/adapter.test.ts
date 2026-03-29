import { describe, expect, test } from "bun:test";

import { buildRequestUrl, rankHttpPlatformCandidates } from "../adapter.js";

describe("http toolkit helpers", () => {
  test("ranks GitHub for github.com targets", () => {
    expect(rankHttpPlatformCandidates("github.com")).toContain("github");
  });

  test("prefers Confluence when the URL path lives under /wiki", () => {
    expect(rankHttpPlatformCandidates("officialgxdyt.atlassian.net", "https://officialgxdyt.atlassian.net/wiki/spaces/ENG")).toEqual([
      "confluence",
      "jira",
    ]);
  });

  test("prefers Jira when the URL path looks like an issue or Jira REST call", () => {
    expect(rankHttpPlatformCandidates("officialgxdyt.atlassian.net", "https://officialgxdyt.atlassian.net/rest/api/3/myself")).toEqual([
      "jira",
      "confluence",
    ]);
  });

  test("builds full request URLs from relative paths", () => {
    expect(buildRequestUrl("/settings/profile", "https://github.com/")).toBe("https://github.com/settings/profile");
    expect(buildRequestUrl("settings/profile", "https://github.com")).toBe("https://github.com/settings/profile");
  });
});
