import { afterEach, describe, expect, test } from "bun:test";

import { getPlatformDefinition } from "../platforms/index.js";
import { loadRootStatusEntries, summarizeRootStatusEntries } from "../commands/status.js";

import type { ConnectionRecord } from "../core/auth/auth-types.js";
import type { AdapterStatusResult } from "../types.js";

const originalGithubAdapter = getPlatformDefinition("github")?.adapter;

afterEach(() => {
  const github = getPlatformDefinition("github");
  if (github) {
    github.adapter = originalGithubAdapter;
  }
});

describe("root status command helpers", () => {
  test("uses last-known saved status by default", async () => {
    const sessions = await loadRootStatusEntries({
      refresh: false,
      connectionStore: {
        listConnections: async () => [createConnectionEntry()],
      },
    });

    expect(sessions).toEqual([
      expect.objectContaining({
        platform: "github",
        account: "default",
        status: "active",
        basis: "last-known",
      }),
    ]);
  });

  test("refreshes through the provider adapter when requested", async () => {
    const github = getPlatformDefinition("github");
    expect(github).toBeDefined();
    github!.adapter = {
      async getStatus(account?: string): Promise<AdapterStatusResult> {
        return {
          platform: "github",
          account: account ?? "default",
          sessionPath: "/tmp/github/default.json",
          connected: false,
          status: "expired",
          message: "GitHub session expired.",
          user: { username: "octocat" },
          lastValidatedAt: "2026-04-10T12:00:00.000Z",
        };
      },
    };

    const sessions = await loadRootStatusEntries({
      refresh: true,
      connectionStore: {
        listConnections: async () => [createConnectionEntry()],
      },
    });

    expect(sessions).toEqual([
      expect.objectContaining({
        platform: "github",
        account: "default",
        status: "expired",
        basis: "live",
        connected: false,
        message: "GitHub session expired.",
      }),
    ]);
  });

  test("keeps the last-known status when live refresh fails", async () => {
    const github = getPlatformDefinition("github");
    expect(github).toBeDefined();
    github!.adapter = {
      async getStatus(): Promise<AdapterStatusResult> {
        throw new Error("network down");
      },
    };

    const sessions = await loadRootStatusEntries({
      refresh: true,
      connectionStore: {
        listConnections: async () => [createConnectionEntry()],
      },
    });

    expect(sessions).toEqual([
      expect.objectContaining({
        platform: "github",
        account: "default",
        status: "active",
        basis: "refresh-failed",
        refreshError: "network down",
      }),
    ]);
    expect(sessions[0]?.message).toContain("Live refresh failed: network down");
  });

  test("summarizes live and stale basis counts separately", () => {
    const summary = summarizeRootStatusEntries([
      {
        platform: "github",
        account: "default",
        sessionPath: "/tmp/github/default.json",
        connected: true,
        status: "active",
        auth: "cookies",
        basis: "live",
      },
      {
        platform: "x",
        account: "default",
        sessionPath: "/tmp/x/default.json",
        connected: false,
        status: "expired",
        auth: "cookies",
        basis: "refresh-failed",
      },
      {
        platform: "youtube",
        account: "default",
        sessionPath: "/tmp/youtube/default.json",
        connected: false,
        status: "unknown",
        auth: "cookies",
        basis: "last-known",
      },
    ]);

    expect(summary).toEqual({
      total: 3,
      active: 1,
      expired: 1,
      unknown: 1,
      live: 1,
      lastKnown: 1,
      refreshFailed: 1,
    });
  });
});

function createConnectionEntry(): { connection: ConnectionRecord; path: string } {
  return {
    path: "/tmp/github/default.json",
    connection: {
      version: 1,
      platform: "github",
      account: "default",
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
      auth: {
        kind: "cookies",
        source: "cookie_json",
      },
      status: {
        state: "active",
        message: "Saved GitHub web session.",
        lastValidatedAt: "2026-04-10T00:00:00.000Z",
      },
      user: {
        username: "octocat",
      },
    },
  };
}
