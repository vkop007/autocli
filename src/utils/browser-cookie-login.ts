import { constants } from "node:fs";
import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { AutoCliError } from "../errors.js";
import {
  getPlatformBrowserAuthCookieNames,
  getPlatformBrowserAuthStorageKeys,
  getPlatformCookieDomain,
  getPlatformDisplayName,
  getPlatformHomeUrl,
} from "../platforms/config.js";
import type { Platform } from "../types.js";

export interface BrowserLoginCapture {
  cookies: unknown[];
  finalUrl: string;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}

const WEAK_BROWSER_AUTH_COOKIE_NAMES = new Set([
  "_gh_sess",
  "_gitlab_session",
  "JSESSIONID",
  "atlassian.xsrf.token",
  "csrftoken",
  "ct0",
]);

const BOOLEAN_BROWSER_AUTH_COOKIE_NAMES = new Set([
  "logged_in",
  "is_logged_in",
]);

const FALSEY_AUTH_COOKIE_VALUES = new Set([
  "",
  "0",
  "false",
  "no",
  "null",
  "undefined",
]);

export async function captureBrowserLogin(
  platform: Platform,
  input: {
    browserUrl?: string;
    timeoutSeconds?: number;
  } = {},
): Promise<BrowserLoginCapture> {
  const executablePath = await resolveBrowserExecutable();
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), `autocli-browser-${platform}-`));
  const timeoutMs = Math.max(1, input.timeoutSeconds ?? 600) * 1000;
  const displayName = getPlatformDisplayName(platform);
  const startUrl = input.browserUrl?.trim() || getPlatformHomeUrl(platform);
  const authCookieNames = getPlatformBrowserAuthCookieNames(platform);
  const authStorageKeys = getPlatformBrowserAuthStorageKeys(platform);
  const expectedDomain = getPlatformCookieDomain(platform);

  let browserContext: {
    pages(): Array<{ url(): string; goto(url: string, options?: unknown): Promise<unknown>; waitForTimeout(ms: number): Promise<void>; evaluate<T>(fn: () => T): Promise<T> }>;
    newPage(): Promise<{ url(): string; goto(url: string, options?: unknown): Promise<unknown>; waitForTimeout(ms: number): Promise<void>; evaluate<T>(fn: () => T): Promise<T> }>;
    cookies(): Promise<unknown[]>;
    close(): Promise<void>;
  } | null = null;

  try {
    const { chromium } = await import("playwright-core");
    browserContext = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      executablePath,
      viewport: { width: 1440, height: 900 },
    });

    const page = browserContext.pages()[0] ?? (await browserContext.newPage());

    console.log(`Opening browser for ${displayName} login: ${startUrl}`);
    console.log(`Complete the sign-in flow in the opened browser window. AutoCLI will save the session automatically once login is detected.`);

    await page.goto(startUrl, { waitUntil: "domcontentloaded" });

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const cookies = await browserContext.cookies();
      const storage = await readStorage(page);
      if (hasDetectedAuthenticatedState(cookies, authCookieNames, authStorageKeys, expectedDomain, storage)) {
        return {
          cookies,
          finalUrl: page.url(),
          localStorage: storage.localStorage,
          sessionStorage: storage.sessionStorage,
        };
      }

      await page.waitForTimeout(1000);
    }

    throw new AutoCliError(
      "BROWSER_LOGIN_TIMEOUT",
      `Timed out waiting for ${displayName} browser login. Complete the sign-in flow within ${Math.round(timeoutMs / 1000)} seconds and try again.`,
      {
        details: {
          platform,
          startUrl,
          timeoutSeconds: Math.round(timeoutMs / 1000),
        },
      },
    );
  } catch (error) {
    if (error instanceof AutoCliError) {
      throw error;
    }

    throw new AutoCliError(
      "BROWSER_LOGIN_FAILED",
      `Failed to start browser login for ${displayName}.`,
      {
        cause: error,
        details: {
          platform,
          startUrl,
          executablePath,
        },
      },
    );
  } finally {
    if (browserContext) {
      await browserContext.close().catch(() => {});
    }

    await rm(userDataDir, { force: true, recursive: true }).catch(() => {});
  }
}

async function resolveBrowserExecutable(): Promise<string> {
  const override = process.env.AUTOCLI_BROWSER_PATH?.trim();
  if (override) {
    await access(override, constants.X_OK).catch(() => {
      throw new AutoCliError("BROWSER_NOT_FOUND", `AUTOCLI_BROWSER_PATH points to a browser that is not executable: ${override}`);
    });
    return override;
  }

  const candidates = process.platform === "darwin"
    ? [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      ]
    : process.platform === "win32"
      ? [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          path.join(process.env.LOCALAPPDATA ?? "", "Google\\Chrome\\Application\\chrome.exe"),
          path.join(process.env.PROGRAMFILES ?? "", "Chromium\\Application\\chrome.exe"),
        ]
      : [
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
          "/usr/bin/chromium-browser",
          "/usr/bin/chromium",
          "/snap/bin/chromium",
        ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new AutoCliError(
    "BROWSER_NOT_FOUND",
    "Could not find a Chrome or Chromium executable. Install Chrome/Chromium or set AUTOCLI_BROWSER_PATH to the browser binary.",
  );
}

async function readStorage(page: {
  evaluate<T>(fn: () => T): Promise<T>;
}): Promise<{ localStorage: Record<string, string>; sessionStorage: Record<string, string> }> {
  try {
    return await page.evaluate(() => {
      const localStorageEntries: Record<string, string> = {};
      const sessionStorageEntries: Record<string, string> = {};

      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key) continue;
        const value = window.localStorage.getItem(key);
        if (value !== null) {
          localStorageEntries[key] = value;
        }
      }

      for (let index = 0; index < window.sessionStorage.length; index += 1) {
        const key = window.sessionStorage.key(index);
        if (!key) continue;
        const value = window.sessionStorage.getItem(key);
        if (value !== null) {
          sessionStorageEntries[key] = value;
        }
      }

      return {
        localStorage: localStorageEntries,
        sessionStorage: sessionStorageEntries,
      };
    });
  } catch {
    return {
      localStorage: {},
      sessionStorage: {},
    };
  }
}

export function hasDetectedAuthenticatedState(
  cookies: unknown[],
  authCookieNames: readonly string[],
  authStorageKeys: readonly string[],
  expectedDomain: string,
  storage: { localStorage: Record<string, string>; sessionStorage: Record<string, string> },
): boolean {
  const browserCookies = Array.isArray(cookies) ? cookies : [];
  const matchingDomainCookies = browserCookies.filter((cookie) => {
    if (!cookie || typeof cookie !== "object") {
      return false;
    }

    const domain = "domain" in cookie && typeof cookie.domain === "string" ? cookie.domain : "";
    return domain.replace(/^\./u, "").endsWith(expectedDomain);
  });

  if (authCookieNames.some((pattern) => browserCookies.some((cookie) => isStrongBrowserAuthCookie(cookie, pattern)))) {
    return true;
  }

  if (authStorageKeys.some((key) => hasTruthyStorageValue(storage.localStorage[key]) || hasTruthyStorageValue(storage.sessionStorage[key]))) {
    return true;
  }

  if (authCookieNames.length === 0 && authStorageKeys.length === 0 && matchingDomainCookies.length > 0) {
    const localStorageKeys = Object.keys(storage.localStorage);
    const sessionStorageKeys = Object.keys(storage.sessionStorage);
    if (localStorageKeys.length > 0 || sessionStorageKeys.length > 0) {
      return true;
    }
  }

  return false;
}

function isStrongBrowserAuthCookie(cookie: unknown, pattern: string): boolean {
  if (!cookie || typeof cookie !== "object") {
    return false;
  }

  const name = "name" in cookie && typeof cookie.name === "string" ? cookie.name : null;
  const value = "value" in cookie && typeof cookie.value === "string" ? cookie.value : "";
  if (!name || !matchesCookiePattern(name, pattern)) {
    return false;
  }

  if (WEAK_BROWSER_AUTH_COOKIE_NAMES.has(name)) {
    return false;
  }

  if (BOOLEAN_BROWSER_AUTH_COOKIE_NAMES.has(name)) {
    return !FALSEY_AUTH_COOKIE_VALUES.has(value.trim().toLowerCase());
  }

  return value.trim().length > 0;
}

function matchesCookiePattern(name: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    return name.startsWith(pattern.slice(0, -1));
  }

  return name === pattern;
}

function hasTruthyStorageValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0 && !FALSEY_AUTH_COOKIE_VALUES.has(value.trim().toLowerCase());
}
