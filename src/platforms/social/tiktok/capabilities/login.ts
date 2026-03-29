import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { tiktokAdapter } from "../adapter.js";

export const tiktokLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Import cookies and save the TikTok session for future headless use",
  spinnerText: "Importing TikTok session...",
  successMessage: "TikTok session imported.",
  options: createCookieLoginOptions(),
  action: ({ options }) => tiktokAdapter.login(resolveCookieLoginInput(options)),
});
