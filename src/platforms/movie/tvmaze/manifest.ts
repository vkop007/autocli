import { createPublicMovieCapabilities } from "../shared/public-capabilities.js";
import { tvMazeAdapter } from "./adapter.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const tvMazePlatformDefinition: PlatformDefinition = {
  id: "tvmaze",
  category: "movie",
  displayName: "TVMaze",
  description: "Search public TV and anime titles through TVMaze",
  authStrategies: ["none"],
  adapter: tvMazeAdapter,
  capabilities: createPublicMovieCapabilities(tvMazeAdapter, {
    searchDescription: "Search public TVMaze titles",
    titleDescription: "Load a TVMaze title by URL, show ID, or query",
  }),
  examples: [
    'autocli tvmaze search "naruto"',
    "autocli tvmaze title 82",
    "autocli tvmaze info https://www.tvmaze.com/shows/82/game-of-thrones",
  ],
};
