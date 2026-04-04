import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { createCookieLoginOptions, resolveCookieLoginInput } from "../../../shared/cookie-login.js";
import { instagramAdapter } from "../adapter.js";

export const instagramLoginCapability = createAdapterActionCapability({
  id: "login",
  command: "login",
  description: "Save the Instagram session for future headless use. With no auth flags, AutoCLI opens browser login by default",
  spinnerText: "Saving Instagram session...",
  successMessage: "Instagram session saved.",
  options: createCookieLoginOptions(),
  action: ({ options }) => instagramAdapter.login(resolveCookieLoginInput(options)),
});
