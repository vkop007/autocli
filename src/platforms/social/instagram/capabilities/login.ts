import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { instagramAdapter } from "../adapter.js";

export const instagramLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Import cookies and save the Instagram session for future headless use",
  spinnerText: "Importing Instagram session...",
  successMessage: "Instagram session imported.",
  options: createCookieLoginOptions(),
  action: ({ options }) => instagramAdapter.login(resolveCookieLoginInput(options)),
});
