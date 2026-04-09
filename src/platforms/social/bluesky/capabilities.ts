import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { parseSocialLimitOption } from "../shared/options.js";
import { printSocialPostsResult, printSocialProfileResult, printSocialSearchResult, printSocialThreadResult } from "../shared/output.js";
import { blueskyAdapter } from "./adapter.js";

import type { PlatformCapability } from "../../../core/runtime/platform-definition.js";

export function createBlueskyCapabilities(): readonly PlatformCapability[] {
  return [
    createAdapterActionCapability({
      id: "login",
      command: "login",
      description: "Save a Bluesky session using a handle and app password",
      spinnerText: "Saving Bluesky session...",
      successMessage: "Bluesky session saved.",
      options: [
        { flags: "--handle <value>", description: "Bluesky handle to log in with", required: true },
        { flags: "--app-password <value>", description: "Bluesky app password", required: true },
        { flags: "--service <url>", description: "Optional ATProto service or PDS URL (default: https://bsky.social)" },
        { flags: "--account <name>", description: "Optional saved session name to use instead of the detected handle" },
      ],
      action: ({ options }) =>
        blueskyAdapter.loginWithCredentials({
          handle: String(options.handle ?? ""),
          appPassword: String(options.appPassword ?? ""),
          service: options.service as string | undefined,
          account: options.account as string | undefined,
        }),
    }),
    createAdapterActionCapability({
      id: "status",
      command: "status",
      description: "Show the saved Bluesky session status",
      spinnerText: "Checking Bluesky session...",
      successMessage: "Bluesky session checked.",
      options: [{ flags: "--account <name>", description: "Optional saved Bluesky session name to inspect" }],
      action: ({ options }) => blueskyAdapter.statusAction(options.account as string | undefined),
    }),
    createAdapterActionCapability({
      id: "me",
      command: "me",
      aliases: ["account"],
      description: "Load the current Bluesky account profile from the saved session",
      spinnerText: "Loading Bluesky profile...",
      successMessage: "Bluesky profile loaded.",
      options: [{ flags: "--account <name>", description: "Optional saved Bluesky session name to use" }],
      action: ({ options }) => blueskyAdapter.me(options.account as string | undefined),
      onSuccess: printSocialProfileResult,
    }),
    createAdapterActionCapability({
      id: "search",
      command: "search <query>",
      description: "Search public Bluesky profiles through the public appview actor search endpoint",
      spinnerText: "Searching Bluesky...",
      successMessage: "Bluesky search completed.",
      options: [{ flags: "--limit <number>", description: "Maximum results to return (default: 5)", parser: parseSocialLimitOption }],
      action: ({ args, options }) =>
        blueskyAdapter.search({
          query: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
        }),
      onSuccess: printSocialSearchResult,
    }),
    createAdapterActionCapability({
      id: "profile",
      command: "profile <target>",
      aliases: ["user"],
      description: "Load a Bluesky profile by URL, @handle, handle, or DID",
      spinnerText: "Loading Bluesky profile...",
      successMessage: "Bluesky profile loaded.",
      action: ({ args }) =>
        blueskyAdapter.profileInfo({
          target: String(args[0] ?? ""),
        }),
      onSuccess: printSocialProfileResult,
    }),
    createAdapterActionCapability({
      id: "posts",
      command: "posts <target>",
      aliases: ["feed"],
      description: "Load recent public Bluesky posts for a profile",
      spinnerText: "Loading Bluesky posts...",
      successMessage: "Bluesky posts loaded.",
      options: [{ flags: "--limit <number>", description: "Maximum posts to return (default: 5)", parser: parseSocialLimitOption }],
      action: ({ args, options }) =>
        blueskyAdapter.posts({
          target: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
        }),
      onSuccess: (result, json) => {
        printSocialPostsResult(result, json, "posts");
      },
    }),
    createAdapterActionCapability({
      id: "thread",
      command: "thread <target>",
      aliases: ["info"],
      description: "Load a public Bluesky thread by URL or at:// post URI",
      spinnerText: "Loading Bluesky thread...",
      successMessage: "Bluesky thread loaded.",
      options: [{ flags: "--limit <number>", description: "Maximum replies to return (default: 5)", parser: parseSocialLimitOption }],
      action: ({ args, options }) =>
        blueskyAdapter.threadInfo({
          target: String(args[0] ?? ""),
          limit: options.limit as number | undefined,
        }),
      onSuccess: printSocialThreadResult,
    }),
    createAdapterActionCapability({
      id: "post",
      command: "post <text...>",
      description: "Create a text Bluesky post from the saved session",
      spinnerText: "Posting to Bluesky...",
      successMessage: "Bluesky post created.",
      options: [{ flags: "--account <name>", description: "Optional saved Bluesky session name to use" }],
      action: ({ args, options }) =>
        blueskyAdapter.postText({
          account: options.account as string | undefined,
          text: Array.isArray(args[0]) ? args[0].join(" ") : String(args[0] ?? ""),
        }),
    }),
    createAdapterActionCapability({
      id: "comment",
      command: "comment <target> <text...>",
      aliases: ["reply"],
      description: "Reply to a Bluesky post URL or at:// URI",
      spinnerText: "Posting Bluesky reply...",
      successMessage: "Bluesky reply posted.",
      options: [{ flags: "--account <name>", description: "Optional saved Bluesky session name to use" }],
      action: ({ args, options }) =>
        blueskyAdapter.comment({
          account: options.account as string | undefined,
          target: String(args[0] ?? ""),
          text: Array.isArray(args[1]) ? args[1].join(" ") : String(args[1] ?? ""),
        }),
    }),
    createAdapterActionCapability({
      id: "like",
      command: "like <target>",
      description: "Like a Bluesky post URL or at:// URI",
      spinnerText: "Liking Bluesky post...",
      successMessage: "Bluesky post liked.",
      options: [{ flags: "--account <name>", description: "Optional saved Bluesky session name to use" }],
      action: ({ args, options }) =>
        blueskyAdapter.like({
          account: options.account as string | undefined,
          target: String(args[0] ?? ""),
        }),
    }),
  ];
}

export const blueskyCapabilities = createBlueskyCapabilities();
