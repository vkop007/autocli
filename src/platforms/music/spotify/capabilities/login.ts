import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import type { SpotifyAdapter } from "../service.js";

export function createSpotifyLoginCapability(adapter: SpotifyAdapter) {
  return createAdapterActionCapability({
    id: "login",
    command: "login",
    description: "Import cookies and save the Spotify session for future headless use",
    spinnerText: "Importing Spotify session...",
    successMessage: "Spotify session imported.",
    options: createCookieLoginOptions(),
    action: ({ options }) => adapter.login(resolveCookieLoginInput(options)),
  });
}
