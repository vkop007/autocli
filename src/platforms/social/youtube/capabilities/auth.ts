import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { youtubeAdapter } from "../adapter.js";

export const youtubeLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Save the YouTube session for future headless use. With no auth flags, AutoCLI opens browser login by default",
  spinnerText: "Saving YouTube session...",
  successMessage: "YouTube session saved.",
  options: createCookieLoginOptions(),
  action: ({ options }) => youtubeAdapter.login(resolveCookieLoginInput(options)),
});
