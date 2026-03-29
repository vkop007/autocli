import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { facebookAdapter } from "../adapter.js";

export const facebookLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Import cookies and save the Facebook session for future headless use",
  spinnerText: "Importing Facebook session...",
  successMessage: "Facebook session imported.",
  options: createCookieLoginOptions(),
  action: ({ options }) => facebookAdapter.login(resolveCookieLoginInput(options)),
});
