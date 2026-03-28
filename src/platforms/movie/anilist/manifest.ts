import { createPublicMovieCapabilities } from "../shared/public-capabilities.js";
import { aniListAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const aniListPlatformDefinition: PlatformDefinition = {
  id: "anilist",
  category: "movie",
  displayName: "AniList",
  description: "Search anime and inspect titles through AniList's public API",
  authStrategies: ["none"],
  adapter: aniListAdapter,
  capabilities: createPublicMovieCapabilities(aniListAdapter, {
    searchDescription: "Search AniList anime titles through the public GraphQL API",
    titleDescription: "Load an AniList anime by URL, anime ID, or query",
    trendingDescription: "Load trending anime titles through AniList's public GraphQL API",
    recommendationsDescription: "Load AniList recommendations for an anime",
  }),
  examples: [
    'autocli anilist search "frieren"',
    "autocli anilist trending --limit 10",
    "autocli anilist title 52991",
    "autocli anilist recommendations 20",
    "autocli anilist info https://anilist.co/anime/20/Naruto",
  ],
};
