import { amazonAdapter } from "./adapter.js";
import { createShoppingCapabilities } from "../shared/capabilities.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const amazonPlatformDefinition: PlatformDefinition = {
  id: "amazon",
  category: "shopping",
  displayName: "Amazon",
  description: "Search Amazon, inspect product details, and validate imported shopping sessions across the correct marketplace domain",
  authStrategies: ["cookies"],
  adapter: amazonAdapter,
  capabilities: createShoppingCapabilities(amazonAdapter),
  examples: [
    "autocli amazon login --cookies ./amazon.cookies.json",
    'autocli amazon search "wireless mouse" --limit 5',
    "autocli amazon product B0B296NTFV",
    "autocli amazon orders --limit 5",
  ],
};
