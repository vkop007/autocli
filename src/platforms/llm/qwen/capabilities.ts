import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { printCookieLlmStatusResult, printCookieLlmTextResult } from "../shared/output.js";

import type { PlatformCapability } from "../../../core/runtime/platform-definition.js";
import type { QwenAdapter } from "./adapter.js";

export function createQwenCapabilities(adapter: QwenAdapter): readonly PlatformCapability[] {
  const loginCapability = createAdapterActionCapability({
    id: "login",
    command: "login",
    description: "Import cookies and save the Qwen session for future CLI use",
    spinnerText: "Importing Qwen session...",
    successMessage: "Qwen session imported.",
    options: [
      { flags: "--cookies <path>", description: "Path to cookies.txt or a JSON cookie export" },
      { flags: "--account <name>", description: "Optional saved alias instead of the default session name" },
      { flags: "--cookie-string <value>", description: "Raw cookie string instead of a file" },
      { flags: "--cookie-json <json>", description: "Inline JSON cookie array or jar export" },
      { flags: "--token <value>", description: "Optional bearer token if the cookie export does not include the token cookie" },
    ],
    action: ({ options }) =>
      adapter.login({
        account: options.account as string | undefined,
        cookieFile: options.cookies as string | undefined,
        cookieString: options.cookieString as string | undefined,
        cookieJson: options.cookieJson as string | undefined,
        token: options.token as string | undefined,
      }),
  });

  const statusCapability = createAdapterActionCapability({
    id: "status",
    command: "status",
    description: "Show the saved Qwen cookie-session status",
    spinnerText: "Checking Qwen session status...",
    successMessage: "Qwen status loaded.",
    options: [{ flags: "--account <name>", description: "Optional saved session name to inspect" }],
    action: ({ options }) => adapter.statusAction(options.account as string | undefined),
    onSuccess: printCookieLlmStatusResult,
  });

  const textCapability = createAdapterActionCapability({
    id: "text",
    command: "text <prompt...>",
    description: "Send a text prompt to Qwen",
    spinnerText: "Sending Qwen text prompt...",
    successMessage: "Qwen text prompt completed.",
    options: [
      { flags: "--account <name>", description: "Optional saved session name to use" },
      { flags: "--model <name>", description: "Optional Qwen model name" },
    ],
    action: ({ args, options }) =>
      adapter.text({
        account: options.account as string | undefined,
        model: options.model as string | undefined,
        prompt: args.map(String).join(" ").trim(),
      }),
    onSuccess: printCookieLlmTextResult,
  });

  return [loginCapability, statusCapability, textCapability] as const;
}
