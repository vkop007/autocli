import { createAdapterActionCapability } from "../../../core/runtime/capability-helpers.js";
import { parseMovieLimitOption, parseMovieSeasonOption } from "./options.js";
import { printMovieEpisodesResult, printMovieRecommendationsResult, printMovieSearchResult, printMovieTitleResult } from "./output.js";

import type { AdapterActionResult } from "../../../types.js";
import type { PlatformCapability } from "../../../core/runtime/platform-definition.js";

interface PublicMovieAdapter {
  readonly displayName: string;
  search(input: { query: string; limit?: number }): Promise<AdapterActionResult>;
  titleInfo(input: { target: string }): Promise<AdapterActionResult>;
  recommendations?(input: { target: string; limit?: number }): Promise<AdapterActionResult>;
  trending?(input: { limit?: number }): Promise<AdapterActionResult>;
  episodes?(input: { target: string; season?: number; limit?: number }): Promise<AdapterActionResult>;
}

interface PublicMovieCapabilityOptions {
  searchDescription: string;
  titleDescription: string;
  recommendationsDescription?: string;
  trendingDescription?: string;
  episodesDescription?: string;
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

  if (typeof adapter.trending === "function") {
    capabilities.push(
      createAdapterActionCapability({
        id: "trending",
        command: "trending",
        description: options.trendingDescription ?? `Load trending ${adapter.displayName} titles`,
        spinnerText: `Loading ${adapter.displayName} trending titles...`,
        successMessage: `${adapter.displayName} trending titles loaded.`,
        options: [{ flags: "--limit <number>", description: "Maximum titles to return (default: 5)", parser: parseMovieLimitOption }],
        action: ({ options: commandOptions }) =>
          adapter.trending!({
            limit: commandOptions.limit as number | undefined,
          }),
        onSuccess: printMovieSearchResult,
      }),
    );
  }

  if (typeof adapter.episodes === "function") {
    capabilities.push(
      createAdapterActionCapability({
        id: "episodes",
        command: "episodes <target>",
        aliases: ["season"],
        description: options.episodesDescription ?? `Load ${adapter.displayName} episode details for a title`,
        spinnerText: `Loading ${adapter.displayName} episodes...`,
        successMessage: `${adapter.displayName} episodes loaded.`,
        options: [
          { flags: "--season <number>", description: "Optional season number to filter", parser: parseMovieSeasonOption },
          { flags: "--limit <number>", description: "Maximum episodes to return", parser: parseMovieLimitOption },
        ],
        action: ({ args, options: commandOptions }) =>
          adapter.episodes!({
            target: String(args[0] ?? ""),
            season: commandOptions.season as number | undefined,
            limit: commandOptions.limit as number | undefined,
          }),
        onSuccess: printMovieEpisodesResult,
      }),
    );
  }

  return capabilities;
}
