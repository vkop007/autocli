import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import {
  printInstagramMediaResult,
  printInstagramPostsResult,
  printInstagramProfileResult,
  printInstagramSearchResult,
  printInstagramStoriesResult,
  printInstagramUserListResult,
} from "../output.js";
import { parseInstagramLimitOption, parseInstagramPostTypeOption } from "../options.js";
import { instagramAdapter } from "../adapter.js";

export const instagramSearchCapability = createAdapterActionCapability({
  id: "search",
  command: "search <query>",
  description: "Search Instagram accounts",
  spinnerText: "Searching Instagram...",
  successMessage: "Instagram search completed.",
  options: [
    {
      flags: "--limit <number>",
      description: "Maximum number of results to return (1-25, default: 5)",
      parser: parseInstagramLimitOption,
    },
    { flags: "--account <name>", description: "Optional override for a specific saved Instagram session" },
  ],
  action: ({ args, options }) =>
    instagramAdapter.search({
      account: options.account as string | undefined,
      query: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
    }),
  onSuccess: printInstagramSearchResult,
});

export const instagramPostsCapability = createAdapterActionCapability({
  id: "posts",
  command: "posts <target>",
  description: "List recent Instagram posts for a profile URL, @username, username, or numeric user ID",
  spinnerText: "Loading Instagram posts...",
  successMessage: "Instagram posts loaded.",
  options: [
    {
      flags: "--limit <number>",
      description: "Maximum number of posts to return (1-25, default: 5)",
      parser: parseInstagramLimitOption,
    },
    {
      flags: "--type <kind>",
      description: "Filter posts by media type: all, photo, video, reel, carousel",
      parser: parseInstagramPostTypeOption,
    },
    { flags: "--account <name>", description: "Optional override for a specific saved Instagram session" },
  ],
  action: ({ args, options }) =>
    instagramAdapter.posts({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
      type: options.type as "all" | "photo" | "video" | "reel" | "carousel" | undefined,
    }),
  onSuccess: printInstagramPostsResult,
});

export const instagramStoriesCapability = createAdapterActionCapability({
  id: "stories",
  command: "stories <target>",
  description: "List active Instagram stories for a profile URL, @username, username, or numeric user ID",
  spinnerText: "Loading Instagram stories...",
  successMessage: "Instagram stories loaded.",
  options: [
    {
      flags: "--limit <number>",
      description: "Maximum number of story items to return (1-25, default: 5)",
      parser: parseInstagramLimitOption,
    },
    { flags: "--photos-only", description: "Only return photo stories" },
    { flags: "--videos-only", description: "Only return video stories" },
    { flags: "--account <name>", description: "Optional override for a specific saved Instagram session" },
  ],
  action: ({ args, options }) =>
    instagramAdapter.stories({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
      photosOnly: Boolean(options.photosOnly),
      videosOnly: Boolean(options.videosOnly),
    }),
  onSuccess: printInstagramStoriesResult,
});

export const instagramFollowersCapability = createAdapterActionCapability({
  id: "followers",
  command: "followers <target>",
  description: "List Instagram followers for a profile URL, @username, username, or numeric user ID",
  spinnerText: "Loading Instagram followers...",
  successMessage: "Instagram followers loaded.",
  options: [
    {
      flags: "--limit <number>",
      description: "Maximum number of followers to return (1-25, default: 5)",
      parser: parseInstagramLimitOption,
    },
    { flags: "--cursor <value>", description: "Pagination cursor from a previous --json response" },
    { flags: "--account <name>", description: "Optional override for a specific saved Instagram session" },
  ],
  action: ({ args, options }) =>
    instagramAdapter.followers({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
      cursor: options.cursor as string | undefined,
    }),
  onSuccess: printInstagramUserListResult,
});

export const instagramFollowingCapability = createAdapterActionCapability({
  id: "following",
  command: "following <target>",
  description: "List Instagram following accounts for a profile URL, @username, username, or numeric user ID",
  spinnerText: "Loading Instagram following...",
  successMessage: "Instagram following loaded.",
  options: [
    {
      flags: "--limit <number>",
      description: "Maximum number of following accounts to return (1-25, default: 5)",
      parser: parseInstagramLimitOption,
    },
    { flags: "--cursor <value>", description: "Pagination cursor from a previous --json response" },
    { flags: "--account <name>", description: "Optional override for a specific saved Instagram session" },
  ],
  action: ({ args, options }) =>
    instagramAdapter.following({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
      limit: options.limit as number | undefined,
      cursor: options.cursor as string | undefined,
    }),
  onSuccess: printInstagramUserListResult,
});

export const instagramMediaIdCapability = createAdapterActionCapability({
  id: "mediaid",
  command: "mediaid <target>",
  aliases: ["info"],
  description: "Load exact Instagram media details by URL, shortcode, or numeric media ID",
  spinnerText: "Loading Instagram media details...",
  successMessage: "Instagram media details loaded.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved Instagram session" }],
  action: ({ args, options }) =>
    instagramAdapter.mediaInfo({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
  onSuccess: printInstagramMediaResult,
});

export const instagramProfileIdCapability = createAdapterActionCapability({
  id: "profileid",
  command: "profileid <target>",
  aliases: ["profile"],
  description: "Load exact Instagram profile details by URL, @username, username, or numeric user ID",
  spinnerText: "Loading Instagram profile details...",
  successMessage: "Instagram profile details loaded.",
  options: [{ flags: "--account <name>", description: "Optional override for a specific saved Instagram session" }],
  action: ({ args, options }) =>
    instagramAdapter.profileInfo({
      account: options.account as string | undefined,
      target: String(args[0] ?? ""),
    }),
  onSuccess: printInstagramProfileResult,
});
