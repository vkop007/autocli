import type { LoginInput } from "../../types.js";

type CookieLoginOption = {
  flags: string;
  description: string;
  required?: boolean;
  parser?: (value: string) => unknown;
};

export function createCookieLoginOptions(extraOptions: readonly CookieLoginOption[] = []): readonly CookieLoginOption[] {
  return [
    { flags: "--cookies <path>", description: "Path to cookies.txt or a JSON cookie export" },
    { flags: "--account <name>", description: "Optional saved alias instead of the default session name" },
    { flags: "--cookie-string <value>", description: "Raw cookie string instead of a file" },
    { flags: "--cookie-json <json>", description: "Inline JSON cookie array or jar export" },
    { flags: "--browser", description: "Open a real browser, wait for manual login, then save the extracted session (default when no cookie flags are provided)" },
    { flags: "--browser-timeout <seconds>", description: "Maximum seconds to wait for manual browser login (default: 600)", parser: parseBrowserTimeoutSeconds },
    ...extraOptions,
  ] as const;
}

export function resolveCookieLoginInput(options: Record<string, unknown>): LoginInput {
  const cookieFile = options.cookies as string | undefined;
  const cookieString = options.cookieString as string | undefined;
  const cookieJson = options.cookieJson as string | undefined;
  const browser = Boolean(options.browser) || (!cookieFile && !cookieString && !cookieJson);

  return {
    account: options.account as string | undefined,
    cookieFile,
    cookieString,
    cookieJson,
    browser,
    browserTimeoutSeconds: options.browserTimeout as number | undefined,
  };
}

function parseBrowserTimeoutSeconds(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Expected a positive integer.");
  }

  return parsed;
}

export { parseBrowserTimeoutSeconds };
