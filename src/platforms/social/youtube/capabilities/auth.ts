import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { youtubeAdapter } from "../adapter.js";

export const youtubeLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Import cookies and save the YouTube session for future headless use",
  spinnerText: "Importing YouTube session...",
  successMessage: "YouTube session imported.",
  options: createCookieLoginOptions(),
  action: ({ options }) => youtubeAdapter.login(resolveCookieLoginInput(options)),
});
