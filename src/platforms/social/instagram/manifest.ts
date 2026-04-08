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
    "autocli social instagram login",
    "autocli social instagram login --cookies ./instagram.cookies.txt",
    "autocli social instagram status",
    'autocli social instagram search "blackpink"',
    "autocli social instagram mediaid https://www.instagram.com/p/SHORTCODE/",
    "autocli social instagram profileid @username",
    "autocli social instagram posts @username",
    "autocli social instagram stories @username",
    "autocli social instagram followers @username --limit 5",
    "autocli social instagram following @username --limit 5",
    "autocli tools download video https://www.instagram.com/p/SHORTCODE/ --platform instagram",
    "autocli tools download video https://www.instagram.com/reel/SHORTCODE/ --platform instagram --account default",
    'autocli social instagram post ./photo.jpg --caption "Ship it"',
    "autocli social instagram delete https://www.instagram.com/p/SHORTCODE/",
    "autocli social instagram delete-comment https://www.instagram.com/p/SHORTCODE/ 17900000000000000",
    "autocli social instagram like https://www.instagram.com/p/SHORTCODE/",
    "autocli social instagram unlike https://www.instagram.com/p/SHORTCODE/",
    "autocli social instagram follow @username",
  ],
};
