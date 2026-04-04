import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { facebookAdapter } from "../adapter.js";

export const facebookLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Save the Facebook session for future headless use. With no auth flags, AutoCLI opens browser login by default",
  spinnerText: "Saving Facebook session...",
  successMessage: "Facebook session saved.",
  options: createCookieLoginOptions(),
  action: ({ options }) => facebookAdapter.login(resolveCookieLoginInput(options)),
});
