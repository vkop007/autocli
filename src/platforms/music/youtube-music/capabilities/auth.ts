import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { youtubeMusicAdapter } from "../adapter.js";

export const youtubeMusicLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Import cookies and save the YouTube Music session for future headless use",
  spinnerText: "Importing YouTube Music session...",
  successMessage: "YouTube Music session imported.",
  options: createCookieLoginOptions(),
  action: ({ options }) => youtubeMusicAdapter.login(resolveCookieLoginInput(options)),
});
