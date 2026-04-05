import { instagramAdapter } from "./adapter.js";
import { instagramCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const instagramPlatformDefinition: PlatformDefinition = {
  id: "instagram",
  category: "social",
  displayName: "Instagram",
  description: "Interact with Instagram using an imported browser session. Use `autocli tools download` for media downloads.",
  aliases: ["ig"],
  authStrategies: ["cookies"],
  adapter: instagramAdapter,
  capabilities: instagramCapabilities,
  examples: [
    "autocli instagram login",
    "autocli instagram login --cookies ./instagram.cookies.txt",
    'autocli instagram search "blackpink"',
    "autocli instagram mediaid https://www.instagram.com/p/SHORTCODE/",
    "autocli instagram profileid @username",
    "autocli instagram posts @username",
    "autocli instagram stories @username",
    "autocli instagram followers @username --limit 5",
    "autocli instagram following @username --limit 5",
    "autocli tools download video https://www.instagram.com/p/SHORTCODE/ --platform instagram",
    "autocli tools download video https://www.instagram.com/reel/SHORTCODE/ --platform instagram --account default",
    'autocli instagram post ./photo.jpg --caption "Ship it"',
    "autocli instagram like https://www.instagram.com/p/SHORTCODE/",
    "autocli instagram unlike https://www.instagram.com/p/SHORTCODE/",
    "autocli instagram follow @username",
  ],
};
