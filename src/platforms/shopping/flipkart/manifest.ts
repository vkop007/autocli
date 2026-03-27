import { flipkartAdapter } from "./adapter.js";
import { createShoppingCapabilities } from "../shared/capabilities.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const flipkartPlatformDefinition: PlatformDefinition = {
  id: "flipkart",
  category: "shopping",
  displayName: "Flipkart",
  description: "Search Flipkart, inspect products, and control account data like orders, wishlist, and cart using cookies",
  authStrategies: ["cookies"],
  adapter: flipkartAdapter,
  capabilities: createShoppingCapabilities(flipkartAdapter),
  examples: [
    "autocli flipkart login --cookies ./flipkart.cookies.json",
    'autocli flipkart search "wireless mouse" --limit 5',
    "autocli flipkart product ACCH9SPTRHTWG8QH",
    "autocli flipkart account",
    "autocli flipkart wishlist --limit 5",
    "autocli flipkart cart",
    "autocli flipkart orders --limit 5",
    "autocli flipkart order OD437053000184271100",
  ],
};
