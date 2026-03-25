import { Command } from "commander";

import { XAdapter } from "../adapters/x.js";
import { Logger } from "../logger.js";
import { printJson } from "../utils/output.js";
import { printActionResult, resolveCommandContext, runCommandAction } from "../utils/cli.js";

import type { AdapterActionResult } from "../types.js";

const adapter = new XAdapter();

export function createXCommand(): Command {
  const command = new Command("x")
    .alias("twitter")
    .description("Interact with X/Twitter using an imported browser session")
    .addHelpText(
      "afterAll",
      `
Examples:
  autocli x login --cookies ./x.cookies.json
  autocli x post "Launching AutoCLI"
  autocli x search "openai" --limit 5
  autocli x tweetid https://x.com/user/status/1234567890
  autocli x profileid @OpenAI
  autocli x tweets @OpenAI --limit 5
  autocli x like https://x.com/user/status/1234567890
  autocli x unlike 1234567890
`,
    );

  command
    .command("login")
    .description("Import cookies and save the X session for future headless use")
    .option("--cookies <path>", "Path to cookies.txt or a JSON cookie export")
    .option("--account <name>", "Optional saved alias instead of the detected username")
    .option("--cookie-string <value>", "Raw cookie string instead of a file")
    .option("--cookie-json <json>", "Inline JSON cookie array or jar export")
    .action(async (options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Importing X session...");
      await runCommandAction({
        spinner,
        successMessage: "X session imported.",
        action: () =>
          adapter.login({
            account: options.account,
            cookieFile: options.cookies,
            cookieString: options.cookieString,
            cookieJson: options.cookieJson,
          }),
        onSuccess: (result) => {
          printActionResult(result, ctx.json);
        },
      });
    });

  const postCommand = command
    .command("post <text>")
    .alias("tweet")
    .description("Publish a text post on X, optionally with one image, using the latest saved session by default")
    .option("--image <path>", "Attach an image to the post")
    .option("--account <name>", "Optional override for a specific saved X session")
    .action(async (text, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Creating X post...");
      await runCommandAction({
        spinner,
        successMessage: "X post created.",
        action: () =>
          adapter.postText({
            account: options.account,
            text,
            imagePath: options.image,
          }),
        onSuccess: (result) => {
          printActionResult(result, ctx.json);
        },
      });
    });

  postCommand.alias("publish");

  command
    .command("search <query>")
    .description("Search X accounts")
    .option("--limit <number>", "Maximum number of results to return (1-25, default: 5)", parseLimitOption)
    .option("--account <name>", "Optional override for a specific saved X session")
    .action(async (query, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Searching X...");
      await runCommandAction({
        spinner,
        successMessage: "X search completed.",
        action: () =>
          adapter.search({
            account: options.account,
            query,
            limit: options.limit,
          }),
        onSuccess: (result) => {
          printXUserResultList(result, ctx.json);
        },
      });
    });

  command
    .command("tweetid <target>")
    .alias("info")
    .description("Load exact X post details by URL or tweet ID")
    .option("--account <name>", "Optional override for a specific saved X session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading X post details...");
      await runCommandAction({
        spinner,
        successMessage: "X post details loaded.",
        action: () =>
          adapter.tweetInfo({
            account: options.account,
            target,
          }),
        onSuccess: (result) => {
          printXTweetResult(result, ctx.json);
        },
      });
    });

  command
    .command("profileid <target>")
    .alias("profile")
    .description("Load exact X profile details by URL, @handle, handle, or numeric user ID")
    .option("--account <name>", "Optional override for a specific saved X session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading X profile details...");
      await runCommandAction({
        spinner,
        successMessage: "X profile details loaded.",
        action: () =>
          adapter.profileInfo({
            account: options.account,
            target,
          }),
        onSuccess: (result) => {
          printXProfileResult(result, ctx.json);
        },
      });
    });

  command
    .command("tweets <target>")
    .description("List recent X posts for a profile URL, @handle, handle, or numeric user ID")
    .option("--limit <number>", "Maximum number of posts to return (1-25, default: 5)", parseLimitOption)
    .option("--account <name>", "Optional override for a specific saved X session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Loading X posts...");
      await runCommandAction({
        spinner,
        successMessage: "X posts loaded.",
        action: () =>
          adapter.tweets({
            account: options.account,
            target,
            limit: options.limit,
          }),
        onSuccess: (result) => {
          printXSearchResult(result, ctx.json, "tweets");
        },
      });
    });

  command
    .command("like <target>")
    .description("Like an X post by URL or tweet ID using the latest saved session by default")
    .option("--account <name>", "Optional override for a specific saved X session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Liking X post...");
      await runCommandAction({
        spinner,
        successMessage: "X post liked.",
        action: () =>
          adapter.like({
            account: options.account,
            target,
          }),
        onSuccess: (result) => {
          printActionResult(result, ctx.json);
        },
      });
    });

  command
    .command("unlike <target>")
    .description("Unlike an X post by URL or tweet ID")
    .option("--account <name>", "Optional override for a specific saved X session")
    .action(async (target, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Unliking X post...");
      await runCommandAction({
        spinner,
        successMessage: "X post unliked.",
        action: () =>
          adapter.unlike({
            account: options.account,
            target,
          }),
        onSuccess: (result) => {
          printActionResult(result, ctx.json);
        },
      });
    });

  command
    .command("comment <target> <text>")
    .description("Reply to an X post by URL or tweet ID using the latest saved session by default")
    .option("--account <name>", "Optional override for a specific saved X session")
    .action(async (target, text, options, cmd) => {
      const ctx = resolveCommandContext(cmd);
      const logger = new Logger(ctx);
      const spinner = logger.spinner("Sending X reply...");
      await runCommandAction({
        spinner,
        successMessage: "X reply sent.",
        action: () =>
          adapter.comment({
            account: options.account,
            target,
            text,
          }),
        onSuccess: (result) => {
          printActionResult(result, ctx.json);
        },
      });
    });

  return command;
}

function parseLimitOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Expected --limit to be a positive integer.");
  }

  return parsed;
}

function printXSearchResult(result: AdapterActionResult, json: boolean, key = "results"): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const results = Array.isArray(result.data?.[key]) ? result.data[key] : [];
  for (const [index, rawItem] of results.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as {
      text?: string;
      authorUsername?: string;
      likeCount?: number;
      retweetCount?: number;
      replyCount?: number;
      createdAt?: string;
      url?: string;
    };

    const meta = [
      typeof item.authorUsername === "string" ? `@${item.authorUsername}` : undefined,
      typeof item.likeCount === "number" ? `${item.likeCount} likes` : undefined,
      typeof item.retweetCount === "number" ? `${item.retweetCount} reposts` : undefined,
      typeof item.replyCount === "number" ? `${item.replyCount} replies` : undefined,
      typeof item.createdAt === "string" ? item.createdAt : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. ${item.url ?? "X post"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof item.text === "string" && item.text.length > 0) {
      const preview = item.text.length > 240 ? `${item.text.slice(0, 240)}...` : item.text;
      console.log(`   ${preview.replace(/\s+/g, " ").trim()}`);
    }
  }
}

function printXUserResultList(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);

  const results = Array.isArray(result.data?.results) ? result.data.results : [];
  for (const [index, rawItem] of results.entries()) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as {
      username?: string;
      displayName?: string;
      followersCount?: number;
      followingCount?: number;
      tweetCount?: number;
      verified?: boolean;
      url?: string;
    };

    const meta = [
      typeof item.displayName === "string" ? item.displayName : undefined,
      typeof item.followersCount === "number" ? `${item.followersCount} followers` : undefined,
      typeof item.followingCount === "number" ? `${item.followingCount} following` : undefined,
      typeof item.tweetCount === "number" ? `${item.tweetCount} posts` : undefined,
      item.verified ? "verified" : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    console.log(`${index + 1}. @${item.username ?? "unknown"}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (typeof item.url === "string" && item.url.length > 0) {
      console.log(`   ${item.url}`);
    }
  }
}

function printXTweetResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [
    typeof data.authorUsername === "string" ? `@${data.authorUsername}` : undefined,
    typeof data.likeCount === "number" ? `${data.likeCount} likes` : undefined,
    typeof data.retweetCount === "number" ? `${data.retweetCount} reposts` : undefined,
    typeof data.replyCount === "number" ? `${data.replyCount} replies` : undefined,
    typeof data.viewCount === "number" ? `${data.viewCount} views` : undefined,
    typeof data.createdAt === "string" ? data.createdAt : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.text === "string" && data.text.length > 0) {
    console.log(data.text);
  }
}

function printXProfileResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const data = result.data;
  if (!data || typeof data !== "object") {
    return;
  }

  const meta = [
    typeof data.displayName === "string" ? data.displayName : undefined,
    typeof data.followersCount === "number" ? `${data.followersCount} followers` : undefined,
    typeof data.followingCount === "number" ? `${data.followingCount} following` : undefined,
    typeof data.tweetCount === "number" ? `${data.tweetCount} posts` : undefined,
    data.verified ? "verified" : undefined,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  if (meta.length > 0) {
    console.log(meta.join(" • "));
  }

  if (typeof data.description === "string" && data.description.length > 0) {
    const preview = data.description.length > 300 ? `${data.description.slice(0, 300)}...` : data.description;
    console.log(preview);
  }
}
