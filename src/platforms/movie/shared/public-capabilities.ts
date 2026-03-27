import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { parseMovieLimitOption } from "./options.js";
import { printMovieRecommendationsResult, printMovieSearchResult, printMovieTitleResult } from "./output.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformCapability } from "../../../core/runtime/platform-definition.js";

interface PublicMovieAdapter {
  readonly displayName: string;
  search(input: { query: string; limit?: number }): Promise<AdapterActionResult>;
  titleInfo(input: { target: string }): Promise<AdapterActionResult>;
  recommendations?(input: { target: string; limit?: number }): Promise<AdapterActionResult>;
}

interface PublicMovieCapabilityOptions {
  searchDescription: string;
  titleDescription: string;
  recommendationsDescription?: string;
}

export function createPublicMovieCapabilities(
  adapter: PublicMovieAdapter,
  options: PublicMovieCapabilityOptions,
): readonly PlatformCapability[] {
  const capabilities: PlatformCapability[] = [
    createAdapterActionCapability({
      id: "search",
      command: "search <query>",
      description: options.searchDescription,
      spinnerText: `Searching ${adapter.displayName}...`,
      successMessage: `${adapter.displayName} search completed.`,
      options: [{ flags: "--limit <number>", description: "Maximum results to return (default: 5)", parser: parseMovieLimitOption }],
      action: ({ args, options: commandOptions }) =>
        adapter.search({
          query: String(args[0] ?? ""),
          limit: commandOptions.limit as number | undefined,
        }),
      onSuccess: printMovieSearchResult,
    }),
    createAdapterActionCapability({
      id: "title",
      command: "title <target>",
      aliases: ["info"],
      description: options.titleDescription,
      spinnerText: `Loading ${adapter.displayName} title details...`,
      successMessage: `${adapter.displayName} title loaded.`,
      action: ({ args }) =>
        adapter.titleInfo({
          target: String(args[0] ?? ""),
        }),
      onSuccess: printMovieTitleResult,
    }),
  ];

  if (typeof adapter.recommendations === "function") {
    capabilities.push(
      createAdapterActionCapability({
        id: "recommendations",
        command: "recommendations <target>",
        aliases: ["recs"],
        description: options.recommendationsDescription ?? `Load ${adapter.displayName} recommendations for a title`,
        spinnerText: `Loading ${adapter.displayName} recommendations...`,
        successMessage: `${adapter.displayName} recommendations loaded.`,
        options: [{ flags: "--limit <number>", description: "Maximum recommendations to return (default: 5)", parser: parseMovieLimitOption }],
        action: ({ args, options: commandOptions }) =>
          adapter.recommendations!({
            target: String(args[0] ?? ""),
            limit: commandOptions.limit as number | undefined,
          }),
        onSuccess: printMovieRecommendationsResult,
      }),
    );
  }

  return capabilities;
}
