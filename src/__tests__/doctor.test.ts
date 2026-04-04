import { describe, expect, test } from "bun:test";

import { buildDoctorRecommendations, summarizeDoctorChecks } from "../commands/doctor.js";

describe("doctor summary helpers", () => {
  test("summarizes pass warn fail counts and connection totals", () => {
    const summary = summarizeDoctorChecks([
      {
        id: "sessions-dir",
        category: "filesystem",
        status: "pass",
        message: "ok",
      },
      {
        id: "ffmpeg",
        category: "binary",
        status: "warn",
        message: "missing",
      },
      {
        id: "saved-records",
        category: "connections",
        status: "warn",
        message: "mixed",
        details: {
          records: 3,
          active: 1,
          expired: 1,
          unknown: 1,
        },
      },
      {
        id: "cache-dir",
        category: "filesystem",
        status: "fail",
        message: "not writable",
      },
    ]);

    expect(summary).toEqual({
      pass: 1,
      warn: 2,
      fail: 1,
      total: 4,
      records: 3,
      active: 1,
      expired: 1,
      unknown: 1,
    });
  });

  test("builds useful follow-up recommendations", () => {
    const checks = [
      {
        id: "sessions-dir",
        category: "filesystem" as const,
        status: "fail" as const,
        message: "not writable",
      },
      {
        id: "ffmpeg",
        category: "binary" as const,
        status: "warn" as const,
        message: "missing",
        details: {
          installHint: "Install FFmpeg with `brew install ffmpeg`.",
        },
      },
    ];

    const recommendations = buildDoctorRecommendations(checks, {
      pass: 0,
      warn: 1,
      fail: 1,
      total: 2,
      records: 0,
      active: 0,
      expired: 0,
      unknown: 0,
    });

    expect(recommendations).toEqual([
      "Fix the failing AutoCLI directories first so sessions, browser state, and jobs can be saved correctly.",
      "Run `autocli login --browser` or a provider-specific `login` command to save your first reusable account.",
      "Install FFmpeg with `brew install ffmpeg`.",
    ]);
  });

  test("adds browser-specific recommendations when the shared browser is missing", () => {
    const recommendations = buildDoctorRecommendations(
      [
        {
          id: "browser-executable",
          category: "browser",
          status: "warn",
          message: "missing",
          details: {
            installHint: "Install Google Chrome or Chromium, then re-run `autocli doctor`.",
          },
        },
        {
          id: "shared-browser-profile",
          category: "browser",
          status: "warn",
          message: "not created",
        },
      ],
      {
        pass: 0,
        warn: 2,
        fail: 0,
        total: 2,
        records: 1,
        active: 1,
        expired: 0,
        unknown: 0,
      },
    );

    expect(recommendations).toEqual([
      "Install a Chrome/Chromium browser for browser-backed actions. Install Google Chrome or Chromium, then re-run `autocli doctor`.",
      "Run `autocli login --browser` once to create the shared AutoCLI browser profile before using browser-backed actions.",
    ]);
  });
});
